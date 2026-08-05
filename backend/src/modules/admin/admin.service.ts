import type { Prisma, SubscriptionStatus, TenantStatus } from '@prisma/client';

import type {
  CreateFeatureFlagInput,
  OverridePlanInput,
  TenantListQuery,
  UpdateFeatureFlagInput,
} from './admin.schemas.js';

import { AppError } from '@/common/errors/index.js';
import { logger } from '@/common/logger.js';
import { getPrisma } from '@/db/prisma.js';
import { getRedis } from '@/db/redis.js';
import { QueueName, getQueue } from '@/jobs/queues.js';

// ---------------------------------------------------------------------------
// Status derivation — subscription status wins over tenant.status for the
// billing-relevant states ("trialing", "canceled"); otherwise mirror tenant.
// ---------------------------------------------------------------------------

type ApiTenantStatus = 'active' | 'suspended' | 'trialing' | 'canceled';

function deriveStatus(
  tenantStatus: TenantStatus,
  subStatus: SubscriptionStatus | undefined,
): ApiTenantStatus {
  if (tenantStatus === 'SUSPENDED') return 'suspended';
  if (subStatus === 'CANCELED') return 'canceled';
  if (subStatus === 'TRIALING') return 'trialing';
  return 'active';
}

function apiToTenantStatus(status: ApiTenantStatus): TenantStatus | undefined {
  if (status === 'suspended') return 'SUSPENDED';
  if (status === 'active') return 'ACTIVE';
  return undefined; // trialing/canceled live on subscription
}

// ---------------------------------------------------------------------------
// Revenue math — sum of active subscriptions normalised to monthly.
// ---------------------------------------------------------------------------

function toMonthlyCents(priceCents: number, interval: 'MONTHLY' | 'YEARLY'): number {
  return interval === 'YEARLY' ? Math.round(priceCents / 12) : priceCents;
}

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export async function listTenants(query: TenantListQuery) {
  const prisma = getPrisma();
  const where: Prisma.TenantWhereInput = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { slug: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  const subFilter: Prisma.SubscriptionWhereInput = {};
  if (query.status) {
    const mapped = apiToTenantStatus(query.status);
    if (mapped) where.status = mapped;
    else if (query.status === 'trialing') subFilter.status = 'TRIALING';
    else if (query.status === 'canceled') subFilter.status = 'CANCELED';
  }
  if (query.plan) {
    subFilter.plan = {
      is: { tier: query.plan.toUpperCase() as 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE' },
    };
  }
  if (Object.keys(subFilter).length > 0) {
    where.subscription = { is: subFilter };
  }

  const [rows, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { users: true } },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  // Revenue per tenant = sum of paid invoices to-date, in currency units.
  const tenantIds = rows.map((r) => r.id);
  const invoiceTotals = tenantIds.length
    ? await prisma.invoice.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds }, status: 'PAID' },
        _sum: { amountCents: true },
      })
    : [];
  const revenueByTenant = new Map(
    invoiceTotals.map((row) => [row.tenantId, (row._sum.amountCents ?? 0) / 100]),
  );

  const data = rows.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    planName: t.subscription?.plan.name ?? 'Free',
    status: deriveStatus(t.status, t.subscription?.status),
    usersCount: t._count.users,
    revenue: revenueByTenant.get(t.id) ?? 0,
    createdAt: t.createdAt.toISOString(),
  }));

  return {
    data,
    meta: {
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getTenantDetail(tenantId: string) {
  const prisma = getPrisma();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { users: true } },
    },
  });
  if (!tenant) throw AppError.notFound('Tenant not found');

  // Owner: the first INSTITUTE_OWNER for this tenant.
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: 'INSTITUTE_OWNER' },
    select: { id: true, name: true, email: true },
    orderBy: { createdAt: 'asc' },
  });

  // Revenue: lifetime paid.
  const invoiceSum = await prisma.invoice.aggregate({
    where: { tenantId, status: 'PAID' },
    _sum: { amountCents: true },
  });

  // Usage: derive from Subscription plan limits + counts.
  const limits = (tenant.subscription?.plan.limits ?? {}) as {
    students?: number;
    exams?: number;
    aiCredits?: number;
    storageMb?: number;
  };

  const periodStart = tenant.subscription?.currentPeriodStart ?? new Date(0);
  const [students, exams, aiUsageAgg] = await Promise.all([
    prisma.user.count({ where: { tenantId, role: 'STUDENT', status: { not: 'DELETED' } } }),
    prisma.exam.count({ where: { tenantId, createdAt: { gte: periodStart } } }),
    prisma.aiUsage.aggregate({
      where: { tenantId, createdAt: { gte: periodStart } },
      _sum: { promptTokens: true, completionTokens: true },
    }),
  ]);
  const aiCreditsUsed = Math.round(
    ((aiUsageAgg._sum.promptTokens ?? 0) + (aiUsageAgg._sum.completionTokens ?? 0)) / 1000,
  );

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    planName: tenant.subscription?.plan.name ?? 'Free',
    status: deriveStatus(tenant.status, tenant.subscription?.status),
    usersCount: tenant._count.users,
    revenue: (invoiceSum._sum.amountCents ?? 0) / 100,
    createdAt: tenant.createdAt.toISOString(),
    owner: owner ?? { id: '', name: '(no owner)', email: '' },
    subscription: {
      planId: tenant.subscription?.planId ?? '',
      planName: tenant.subscription?.plan.name ?? 'Free',
      status: (tenant.subscription?.status ?? 'ACTIVE').toLowerCase(),
      currentPeriodEnd:
        tenant.subscription?.currentPeriodEnd?.toISOString() ?? new Date().toISOString(),
    },
    usage: {
      students: { used: students, limit: limits.students ?? 0 },
      exams: { used: exams, limit: limits.exams ?? 0 },
      aiCredits: { used: aiCreditsUsed, limit: limits.aiCredits ?? 0 },
      storage: { usedMb: 0, limitMb: limits.storageMb ?? 0 },
    },
  };
}

export async function setTenantStatus(tenantId: string, status: TenantStatus) {
  const prisma = getPrisma();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw AppError.notFound('Tenant not found');
  await prisma.tenant.update({ where: { id: tenantId }, data: { status } });
  return { ok: true };
}

export async function overridePlan(tenantId: string, input: OverridePlanInput) {
  const prisma = getPrisma();
  const [tenant, plan] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.plan.findUnique({ where: { id: input.planId } }),
  ]);
  if (!tenant) throw AppError.notFound('Tenant not found');
  if (!plan) throw AppError.notFound('Plan not found');

  const now = new Date();
  const periodEnd = new Date(now);
  if (input.trialDays > 0) periodEnd.setDate(periodEnd.getDate() + input.trialDays);
  else periodEnd.setMonth(periodEnd.getMonth() + (plan.interval === 'YEARLY' ? 12 : 1));

  await prisma.subscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      planId: plan.id,
      status: input.trialDays > 0 ? 'TRIALING' : 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      planId: plan.id,
      status: input.trialDays > 0 ? 'TRIALING' : 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Revenue rollup — computed on-read. A nightly materialisation lands with
// a cron in Phase 12 once traffic warrants it.
// ---------------------------------------------------------------------------

export async function getRevenueMetrics() {
  const prisma = getPrisma();
  const now = new Date();

  const activeSubs = await prisma.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'TRIALING'] } },
    include: { plan: true },
  });
  const mrrCents = activeSubs.reduce(
    (acc, s) => acc + toMonthlyCents(s.plan.priceCents, s.plan.interval),
    0,
  );
  const mrr = mrrCents / 100;

  // Monthly paid-invoice totals for the last 6 months.
  const months: { start: Date; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months.push({ start, label });
  }
  const monthlyData = await Promise.all(
    months.map(async ({ start, label }, idx) => {
      const end = months[idx + 1]?.start ?? new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const agg = await prisma.invoice.aggregate({
        where: { status: 'PAID', paidAt: { gte: start, lt: end } },
        _sum: { amountCents: true },
      });
      return { month: label, revenue: (agg._sum.amountCents ?? 0) / 100 };
    }),
  );

  const lastMonth = monthlyData.at(-2)?.revenue ?? 0;
  const thisMonth = monthlyData.at(-1)?.revenue ?? 0;
  const growthRate = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  // Churn rate = canceled subs in the last 30d / total subs at start of window.
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const [canceledRecent, totalSubs] = await Promise.all([
    prisma.subscription.count({
      where: { status: 'CANCELED', updatedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.subscription.count(),
  ]);
  const churnRate = totalSubs > 0 ? (canceledRecent / totalSubs) * 100 : 0;

  return {
    mrr,
    arr: mrr * 12,
    growthRate: Number(growthRate.toFixed(2)),
    churnRate: Number(churnRate.toFixed(2)),
    monthlyData,
  };
}

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export async function listFeatureFlags() {
  const rows = await getPrisma().featureFlag.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(serializeFlag);
}

export async function createFeatureFlag(input: CreateFeatureFlagInput) {
  const prisma = getPrisma();
  const existing = await prisma.featureFlag.findUnique({ where: { key: input.key } });
  if (existing) throw AppError.badRequest(`Flag "${input.key}" already exists`);
  const row = await prisma.featureFlag.create({
    data: {
      key: input.key,
      description: input.description,
      rolloutPercentage: input.rolloutPercentage,
      enabled: false,
    },
  });
  return serializeFlag(row);
}

export async function updateFeatureFlag(id: string, input: UpdateFeatureFlagInput) {
  const prisma = getPrisma();
  const existing = await prisma.featureFlag.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Feature flag not found');
  const row = await prisma.featureFlag.update({
    where: { id },
    data: {
      enabled: input.enabled,
      rolloutPercentage: input.rolloutPercentage,
      description: input.description,
    },
  });
  return serializeFlag(row);
}

export async function deleteFeatureFlag(id: string) {
  const prisma = getPrisma();
  const existing = await prisma.featureFlag.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Feature flag not found');
  await prisma.featureFlag.delete({ where: { id } });
  return { ok: true };
}

function serializeFlag(row: {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
}) {
  return {
    id: row.id,
    key: row.key,
    description: row.description,
    enabled: row.enabled,
    rolloutPercentage: row.rolloutPercentage,
  };
}

// ---------------------------------------------------------------------------
// System health
// ---------------------------------------------------------------------------

export async function getSystemHealth() {
  const prisma = getPrisma();
  const uptime = process.uptime();

  // Queue depth = sum of waiting + delayed across all named queues.
  let queueDepth = 0;
  try {
    const counts = await Promise.all(
      Object.values(QueueName).map(async (name) => {
        const q = getQueue(name);
        const c = await q.getJobCounts('wait', 'waiting', 'delayed', 'active');
        return (c.wait ?? 0) + (c.waiting ?? 0) + (c.delayed ?? 0) + (c.active ?? 0);
      }),
    );
    queueDepth = counts.reduce((a, b) => a + b, 0);
  } catch (err) {
    logger.warn({ err }, 'admin.health: queue count failed');
  }

  // DB connections — Postgres pg_stat_activity for our DB.
  let dbConnections = 0;
  try {
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT count(*)::bigint FROM pg_stat_activity WHERE datname = current_database()',
    );
    dbConnections = Number(rows[0]?.count ?? 0);
  } catch (err) {
    logger.warn({ err }, 'admin.health: db connection probe failed');
  }

  // Cache hit rate — Redis INFO stats: keyspace_hits / (hits + misses).
  let cacheHitRate = 0;
  try {
    const info = await getRedis().info('stats');
    const hits = Number(/keyspace_hits:(\d+)/.exec(info)?.[1] ?? 0);
    const misses = Number(/keyspace_misses:(\d+)/.exec(info)?.[1] ?? 0);
    const total = hits + misses;
    cacheHitRate = total > 0 ? (hits / total) * 100 : 100;
  } catch (err) {
    logger.warn({ err }, 'admin.health: redis stats probe failed');
  }

  // Error rate — % of audit logs with a `.error` meta in the last hour.
  const oneHourAgo = new Date(Date.now() - 3600 * 1000);
  let errorRate = 0;
  try {
    const [errors, total] = await Promise.all([
      prisma.auditLog.count({
        where: {
          createdAt: { gte: oneHourAgo },
          action: { contains: 'error', mode: 'insensitive' },
        },
      }),
      prisma.auditLog.count({ where: { createdAt: { gte: oneHourAgo } } }),
    ]);
    errorRate = total > 0 ? (errors / total) * 100 : 0;
  } catch (err) {
    logger.warn({ err }, 'admin.health: audit-log probe failed');
  }

  const status: 'healthy' | 'degraded' | 'down' =
    errorRate >= 5 || queueDepth >= 500 || dbConnections >= 95
      ? 'down'
      : errorRate >= 1 || queueDepth >= 100 || dbConnections >= 80 || cacheHitRate < 70
        ? 'degraded'
        : 'healthy';

  return {
    status,
    uptime: Math.round(uptime),
    dbConnections,
    cacheHitRate: Number(cacheHitRate.toFixed(2)),
    queueDepth,
    errorRate: Number(errorRate.toFixed(2)),
  };
}
