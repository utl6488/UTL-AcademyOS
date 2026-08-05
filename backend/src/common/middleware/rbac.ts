import type { Role } from '@utl/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from '@/common/errors/index.js';
import type { Permission } from '@/config/constants.js';

/** Allow only the listed roles. Must run after `requireAuth`. */
export function requireRole(...roles: Role[]): RequestHandler {
  const allowed = new Set(roles);
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw AppError.unauthorized();
    if (!allowed.has(req.auth.role)) throw AppError.forbidden('Role not permitted');
    next();
  };
}

/** Allow only when the auth context has ALL of the listed permissions. */
export function requirePermission(...perms: Permission[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw AppError.unauthorized();
    for (const p of perms) {
      if (!req.auth.permissions.has(p)) throw AppError.forbidden(`Missing permission: ${p}`);
    }
    next();
  };
}

/** Allow when the auth context has ANY of the listed permissions. */
export function requireAnyPermission(...perms: Permission[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw AppError.unauthorized();
    for (const p of perms) if (req.auth.permissions.has(p)) return next();
    throw AppError.forbidden(`Requires one of: ${perms.join(', ')}`);
  };
}
