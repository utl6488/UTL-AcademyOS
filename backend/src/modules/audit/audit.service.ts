import { logger } from '@/common/logger.js';
import { getPrisma, withTenant } from '@/db/prisma.js';

interface AuditEntry {
  tenantId?: string | null;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown> | { ip?: string; userAgent?: string };
}

/**
 * Persist an audit record. Fire-and-forget from callers — logs on failure so
 * the caller's happy path isn't blocked by an audit blip.
 */
export function audit(entry: AuditEntry): Promise<void> {
  const write = () =>
    getPrisma()
      .auditLog.create({
        data: {
          tenantId: entry.tenantId ?? null,
          actorId: entry.actorId ?? null,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          meta: (entry.meta ?? undefined) as never,
          ip: extractString(entry.meta, 'ip'),
          userAgent: extractString(entry.meta, 'userAgent'),
        },
      })
      .then(() => undefined)
      .catch((err: unknown) => {
        logger.error({ err, action: entry.action }, 'audit write failed');
      });

  // Always bypass tenant middleware — audit table is tenant-scoped by column
  // but we set tenantId explicitly.
  return withTenant({ tenantId: entry.tenantId ?? '__system__', bypass: true }, write);
}

export const auditFromRequest = audit;

function extractString(meta: AuditEntry['meta'], key: string): string | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : undefined;
}
