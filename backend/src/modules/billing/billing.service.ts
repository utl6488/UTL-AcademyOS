import type { PlanTier, SubscriptionStatus } from '@prisma/client';

import type { ApplyCouponInput, CreateCheckoutInput } from './billing.schemas.js';
import { PLAN_SEEDS } from './plans.seed.js';

import { AppError } from '@/common/errors/index.js';
import { logger } from '@/common/logger.js';
import { env } from '@/config/env.js';
import { getPrisma } from '@/db/prisma.js';

const STATUS_TO_API: Record<
  SubscriptionStatus,
  'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete'
> = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  TRIALING: 'trialing',
  INCOMPLETE: 'incomplete',
};

const TIER_ORDER: Record<PlanTier, number> = { FREE: 0, BASIC: 1, PRO: 2, ENTERPRISE: 3 };

// ---------------------------------------------------------------------------
// Idempotent plan seed — runs once per boot; noop if already seeded.
// ---------------------------------------------------------------------------

export async function ensurePlansSeeded(): Promise<void> {
  const prisma = getPrisma();
  for (const seed of PLAN_SEEDS) {
    await prisma.plan.upsert({
      where: { tier_interval: { tier: seed.tier, interval: seed.interval } },
      create: {
        tier: seed.tier,
        name: seed.name,
        priceCents: seed.priceCents,
        currency: seed.currency,
        interval: seed.interval,
        features: seed.features,
        limits: seed.limits,
        isPublic: seed.isPublic,
      },
      update: {
        name: seed.name,
        priceCents: seed.priceCents,
        features: seed.features,
        limits: seed.limits,
        isPublic: seed.isPublic,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Ensure every tenant has a subscription row (default = Free monthly).
// Called from the auth signup flow and lazily from any billing read.
// ---------------------------------------------------------------------------

export async function ensureFreeSubscription(tenantId: string): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.subscription.findUnique({ where: { tenantId } });
  if (existing) return;
  await ensurePlansSeeded();
  const free = await prisma.plan.findFirst({ where: { tier: 'FREE', interval: 'MONTHLY' } });
  if (!free) throw AppError.internal('Free plan not seeded');
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await prisma.subscription.create({
    data: {
      tenantId,
      planId: free.id,
      status: 'ACTIVE',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listPlans() {
  await ensurePlansSeeded();
  const plans = await getPrisma().plan.findMany({
    where: { isPublic: true },
    orderBy: [{ interval: 'asc' }, { priceCents: 'asc' }],
  });
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.priceCents / 100,
    interval: p.interval.toLowerCase(),
    features: p.features,
    limits: {
      students: (p.limits as { students?: number })?.students ?? 0,
      exams: (p.limits as { exams?: number })?.exams ?? 0,
      aiCredits: (p.limits as { aiCredits?: number })?.aiCredits ?? 0,
      storage: (p.limits as { storageMb?: number })?.storageMb ?? 0,
    },
  }));
}

export async function getSubscription(tenantId: string) {
  await ensureFreeSubscription(tenantId);
  const sub = await getPrisma().subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (!sub) throw AppError.notFound('No subscription');
  return {
    id: sub.id,
    planId: sub.planId,
    planName: sub.plan.name,
    status: STATUS_TO_API[sub.status],
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}

/**
 * Aggregate usage counts against the current plan's limits. Storage is a rough
 * approximation until we have a real object-store size probe.
 */
export async function getUsage(tenantId: string) {
  const prisma = getPrisma();
  await ensureFreeSubscription(tenantId);
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (!sub) throw AppError.notFound('No subscription');
  const limits = sub.plan.limits as {
    students?: number;
    exams?: number;
    aiCredits?: number;
    storageMb?: number;
  };

  // AI credits used = sum of prompt+completion tokens / 1000 in the current period.
  const aiUsage = await prisma.aiUsage.aggregate({
    where: { createdAt: { gte: sub.currentPeriodStart } },
    _sum: { promptTokens: true, completionTokens: true },
  });
  const aiCreditsUsed = Math.round(
    ((aiUsage._sum.promptTokens ?? 0) + (aiUsage._sum.completionTokens ?? 0)) / 1000,
  );

  const [students, exams] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT', status: { not: 'DELETED' } } }),
    prisma.exam.count({ where: { createdAt: { gte: sub.currentPeriodStart } } }),
  ]);

  return {
    students: { used: students, limit: limits.students ?? 0 },
    exams: { used: exams, limit: limits.exams ?? 0 },
    aiCredits: { used: aiCreditsUsed, limit: limits.aiCredits ?? 0 },
    storage: { usedMb: 0, limitMb: limits.storageMb ?? 0 }, // real probe deferred
  };
}

export async function listInvoices(tenantId: string) {
  const rows = await getPrisma().invoice.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    amount: r.amountCents / 100,
    currency: r.currency,
    status: r.status.toLowerCase(),
    paidAt: r.paidAt?.toISOString() ?? null,
    // Always route through our own endpoint — the provider-supplied hosted URL
    // (Stripe/Razorpay) is optional; ours is authoritative for GST invoices.
    downloadUrl: `/api/v1/billing/invoices/${r.id}/download`,
  }));
}

export async function renderInvoiceBuffer(
  tenantId: string,
  invoiceId: string,
): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const prisma = getPrisma();
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!invoice) throw AppError.notFound('Invoice not found');

  const [tenant, sub] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, address: true, email: true },
    }),
    prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: { select: { name: true, interval: true } } },
    }),
  ]);
  if (!tenant) throw AppError.notFound('Tenant not found');

  const { renderInvoicePdf } = await import('./invoice.pdf.js');
  const buffer = await renderInvoicePdf({
    invoiceId: invoice.id,
    createdAt: invoice.createdAt,
    paidAt: invoice.paidAt,
    status: invoice.status,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    gstNumber: invoice.gstNumber,
    gstRateBps: invoice.gstRateBps,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    tenant: { name: tenant.name, address: tenant.address, email: tenant.email },
    plan: {
      name: sub?.plan.name ?? 'Free',
      interval: sub?.plan.interval ?? 'MONTHLY',
    },
  });

  return { buffer, filename: `invoice-${invoice.id}.pdf` };
}

// ---------------------------------------------------------------------------
// Checkout
// Payment-provider abstraction — real Razorpay/Stripe integration lands with
// env-configured API keys + webhook infra. Today: return a placeholder URL and
// short-circuit "activate" for FREE upgrades so the UX loop is usable in dev.
// ---------------------------------------------------------------------------

export async function createCheckout(tenantId: string, input: CreateCheckoutInput) {
  const prisma = getPrisma();
  const plan = await prisma.plan.findFirst({ where: { id: input.planId } });
  if (!plan) throw AppError.notFound('Plan not found');

  // Downgrade / free-tier → activate immediately, no checkout roundtrip.
  if (plan.priceCents === 0) {
    await prisma.subscription.update({
      where: { tenantId },
      data: { planId: plan.id, status: 'ACTIVE', cancelAtPeriodEnd: false, provider: null },
    });
    return { checkoutUrl: `${env.APP_URL}/billing?activated=1` };
  }

  const providerConfigured =
    (input.provider === 'stripe' && Boolean(process.env.STRIPE_SECRET_KEY)) ||
    (input.provider === 'razorpay' && Boolean(process.env.RAZORPAY_KEY_SECRET));

  if (!providerConfigured) {
    // Dev stub: pretend the checkout completed. Real webhook flow lands with
    // env-configured provider keys in a follow-up.
    await prisma.subscription.update({
      where: { tenantId },
      data: {
        planId: plan.id,
        status: 'ACTIVE',
        provider: input.provider,
        cancelAtPeriodEnd: false,
      },
    });
    await prisma.invoice.create({
      data: {
        tenantId,
        amountCents: plan.priceCents,
        currency: plan.currency,
        status: 'PAID',
        paidAt: new Date(),
        periodStart: new Date(),
        periodEnd: nextPeriodEnd(),
      },
    });
    logger.warn({ tenantId, provider: input.provider }, 'billing: checkout stub (no provider key)');
    return { checkoutUrl: `${env.APP_URL}/billing?stub=1` };
  }

  // Provider-configured path is where the real integration slots in.
  // Kept as an explicit throw so it can't silently swallow real traffic.
  throw AppError.internal(`Live ${input.provider} integration not yet wired`);
}

function nextPeriodEnd(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export async function applyCoupon(tenantId: string, input: ApplyCouponInput) {
  const prisma = getPrisma();
  const coupon = await prisma.coupon.findFirst({ where: { code: input.code, isActive: true } });
  if (!coupon) throw AppError.notFound('Coupon not found or inactive');
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    throw AppError.badRequest('Coupon has expired');
  }
  if (coupon.maxRedemptions && coupon.redeemedCount >= coupon.maxRedemptions) {
    throw AppError.badRequest('Coupon has reached its redemption limit');
  }

  await prisma.$transaction([
    prisma.subscription.update({
      where: { tenantId },
      data: { couponId: coupon.id },
    }),
    prisma.coupon.update({
      where: { id: coupon.id },
      data: { redeemedCount: { increment: 1 } },
    }),
  ]);

  const discount = coupon.percentOff > 0 ? coupon.percentOff : (coupon.amountOffCents ?? 0) / 100;
  const message =
    coupon.percentOff > 0
      ? `${coupon.percentOff}% off applied to your next invoice.`
      : `₹${discount} off applied to your next invoice.`;
  return { discount, message };
}

// ---------------------------------------------------------------------------
// Cancel / resume — end-of-period semantics
// ---------------------------------------------------------------------------

export async function cancelSubscription(tenantId: string) {
  const prisma = getPrisma();
  await prisma.subscription.update({
    where: { tenantId },
    data: { cancelAtPeriodEnd: true },
  });
  return { ok: true };
}

export async function resumeSubscription(tenantId: string) {
  const prisma = getPrisma();
  await prisma.subscription.update({
    where: { tenantId },
    data: { cancelAtPeriodEnd: false, status: 'ACTIVE' },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Plan-gate helper (feature-flag middleware surface).
// Callers pass a limit name; we compare current usage to the tenant's plan.
// Not wired anywhere yet — modules will opt-in as needed (Phase 9 follow-up).
// ---------------------------------------------------------------------------

export async function assertUnderLimit(
  tenantId: string,
  limit: 'students' | 'exams' | 'aiCredits',
): Promise<void> {
  const usage = await getUsage(tenantId);
  const meter = usage[limit];
  if (meter.limit > 0 && meter.used >= meter.limit) {
    throw AppError.badRequest(`Plan limit reached for ${limit}. Upgrade to continue.`);
  }
}

/** Compare two tiers — util for gating premium features. */
export async function isTierAtLeast(tenantId: string, min: PlanTier): Promise<boolean> {
  const sub = await getPrisma().subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (!sub) return TIER_ORDER.FREE >= TIER_ORDER[min];
  return TIER_ORDER[sub.plan.tier] >= TIER_ORDER[min];
}
