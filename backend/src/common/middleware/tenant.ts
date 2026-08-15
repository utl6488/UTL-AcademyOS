import type { NextFunction, Request, Response } from 'express';

import { AppError } from '@/common/errors/index.js';
import { runWithTenant } from '@/db/prisma.js';

/**
 * Pins the tenant scope for the lifetime of the request. Must run AFTER
 * `requireAuth`. Wraps `next()` in the tenant AsyncLocalStorage so every Prisma
 * query in this request path is auto-scoped by tenantId.
 */
export function tenantScope(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) throw AppError.unauthorized();
  // SUPER_ADMIN can address any tenant via a `x-tenant-id` header.
  const tenantId =
    req.auth.role === 'SUPER_ADMIN'
      ? req.header('x-tenant-id') || req.auth.tenantId
      : req.auth.tenantId;
  req.tenantId = tenantId;
  runWithTenant(
    { tenantId, bypass: req.auth.role === 'SUPER_ADMIN' && !req.header('x-tenant-id') },
    () => next(),
  );
}
