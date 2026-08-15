import { AsyncLocalStorage } from 'node:async_hooks';

import { type Prisma, PrismaClient } from '@prisma/client';

import { logger } from '@/common/logger.js';
import { env } from '@/config/env.js';

interface TenantContext {
  tenantId: string;
  /** Set true when the caller is a super-admin bypassing tenant isolation. */
  bypass?: boolean;
}

const tenantAls = new AsyncLocalStorage<TenantContext>();

/** Run a block with a tenant scope pinned. All Prisma queries inside get filtered. */
export function withTenant<T>(ctx: TenantContext, fn: () => Promise<T>): Promise<T> {
  return tenantAls.run(ctx, fn);
}

/**
 * Sync variant of `withTenant` — for Express middleware where we want to wrap
 * `next()` (which returns void) so the tenant context propagates to all
 * downstream async handlers via AsyncLocalStorage.
 */
export function runWithTenant(ctx: TenantContext, fn: () => void): void {
  tenantAls.run(ctx, fn);
}

/** Read the active tenant scope (undefined outside a `withTenant` block). */
export function currentTenant(): TenantContext | undefined {
  return tenantAls.getStore();
}

/** Tables that carry `tenantId` and must be auto-filtered. Keep in sync with schema. */
const TENANT_SCOPED_MODELS = new Set<string>([
  'User',
  'RefreshToken',
  'OtpToken',
  'AuditLog',
  'UserPermission',
  'Branch',
  'AcademicYear',
  'Class',
  'Section',
  'Batch',
  'Subject',
  'Topic',
  'ImportJob',
  'Question',
  'QuestionVersion',
  'Exam',
  'ExamSection',
  'ExamQuestion',
  'ExamAssignment',
  'ExamAttempt',
  'AttemptAnswer',
  'AttemptEvent',
  'Result',
  'AiUsage',
  'AiFeedback',
  'StudentStudyPlan',
  'Embedding',
  'Subscription',
  'Invoice',
]);

function makeClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).$on('warn', (e: Prisma.LogEvent) => logger.warn({ prisma: e }, 'prisma warn'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).$on('error', (e: Prisma.LogEvent) => logger.error({ prisma: e }, 'prisma error'));

  client.$use(async (params, next) => {
    const ctx = tenantAls.getStore();
    const model = params.model;
    if (!model || !TENANT_SCOPED_MODELS.has(model) || ctx?.bypass) {
      return next(params);
    }
    if (!ctx?.tenantId) {
      // Guard: never let a tenant-scoped query run without a scope in prod.
      // In tests / migrations you may explicitly use `withTenant({ bypass: true })`.
      throw new Error(`Prisma call on ${model}.${params.action} without tenant scope`);
    }
    injectTenantFilter(params, ctx.tenantId);
    return next(params);
  });

  return client;
}

function injectTenantFilter(params: Prisma.MiddlewareParams, tenantId: string): void {
  const { action } = params;
  const args = (params.args ??= {});

  switch (action) {
    // Filter-style where inputs — AND wrap is safe and handles OR/AND clauses cleanly.
    case 'findFirst':
    case 'findMany':
    case 'count':
    case 'aggregate':
    case 'groupBy':
    case 'updateMany':
    case 'deleteMany':
    case 'findFirstOrThrow': {
      args.where = { AND: [{ tenantId }, args.where ?? {}] };
      break;
    }
    // findUnique/findUniqueOrThrow require strict unique keys — downgrade to
    // findFirst semantics so we can layer the tenant filter with AND.
    case 'findUnique': {
      args.where = { AND: [{ tenantId }, args.where ?? {}] };
      params.action = 'findFirst';
      break;
    }
    case 'findUniqueOrThrow': {
      args.where = { AND: [{ tenantId }, args.where ?? {}] };
      params.action = 'findFirstOrThrow';
      break;
    }
    // Unique-where inputs (update/delete/upsert) require the identity field at
    // top level. Spread tenantId alongside it — Prisma accepts extra filter fields.
    case 'update':
    case 'delete':
    case 'upsert': {
      args.where = { ...(args.where ?? {}), tenantId };
      if (action === 'upsert') {
        args.create = { ...(args.create ?? {}), tenantId };
      }
      break;
    }
    case 'create': {
      args.data = { ...(args.data ?? {}), tenantId: args.data?.tenantId ?? tenantId };
      break;
    }
    case 'createMany': {
      const rows: Array<Record<string, unknown>> = Array.isArray(args.data)
        ? args.data
        : [args.data];
      args.data = rows.map((r) => ({ ...r, tenantId: r.tenantId ?? tenantId }));
      break;
    }
    default:
      break;
  }
}

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prismaInstance) prismaInstance = makeClient();
  return prismaInstance;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getPrisma() as any)[prop];
  },
});

export async function disconnectPrisma(): Promise<void> {
  if (!prismaInstance) return;
  await prismaInstance.$disconnect();
  prismaInstance = null;
}

export async function getPrismaHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
