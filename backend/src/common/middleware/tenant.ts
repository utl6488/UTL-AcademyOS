import type { NextFunction, Request, Response } from 'express';

import { AppError } from '@/common/errors/index.js';
import { withTenant } from '@/db/prisma.js';

/**
 * Pins the tenant scope for the lifetime of the request. Must run AFTER
 * `requireAuth`. Wraps `next()` in `withTenant` so every Prisma query in this
 * request path is auto-scoped by tenantId.
 */
export function tenantScope(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) throw AppError.unauthorized();
  // SUPER_ADMIN can address any tenant via a `x-tenant-id` header.
  const tenantId =
    req.auth.role === 'SUPER_ADMIN'
      ? req.header('x-tenant-id') || req.auth.tenantId
      : req.auth.tenantId;
  req.tenantId = tenantId;
  withTenant(
    { tenantId, bypass: req.auth.role === 'SUPER_ADMIN' && !req.header('x-tenant-id') },
    () =>
      new Promise<void>((resolve, reject) =>
        next((err: unknown) =>
          err ? reject(err instanceof Error ? err : new Error(String(err))) : resolve(),
        ),
      ),
  ).catch(next);
}
