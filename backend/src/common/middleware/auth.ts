import type { NextFunction, Request, Response } from 'express';

import { AppError } from '@/common/errors/index.js';
import { permissionsFor } from '@/config/constants.js';
import { verifyAccessToken } from '@/modules/auth/token.service.js';

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * Verifies the Bearer JWT, populates `req.auth`, and enforces tenant scope on
 * the request. Subsequent RBAC middleware relies on this.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const match = header ? BEARER.exec(header) : null;
  const raw = match?.[1];
  if (!raw) throw AppError.unauthorized('Missing Bearer token');
  const claims = verifyAccessToken(raw);
  req.auth = {
    userId: claims.sub,
    tenantId: claims.tid,
    role: claims.role,
    sessionId: claims.sid,
    permissions: permissionsFor(claims.role),
  };
  req.tenantId = claims.tid;
  next();
}

/** Same as `requireAuth` but does not throw when unauthenticated. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const match = header ? BEARER.exec(header) : null;
  const raw = match?.[1];
  if (!raw) return next();
  try {
    const claims = verifyAccessToken(raw);
    req.auth = {
      userId: claims.sub,
      tenantId: claims.tid,
      role: claims.role,
      sessionId: claims.sid,
      permissions: permissionsFor(claims.role),
    };
    req.tenantId = claims.tid;
  } catch {
    // ignore — treat as anonymous
  }
  next();
}
