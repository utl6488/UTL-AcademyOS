import type { Request, Response } from 'express';

import { AppError } from '@/common/errors/index.js';
import { ok } from '@/common/response.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';
import { permissionsFor } from '@/config/constants.js';
import { getPrisma, withTenant } from '@/db/prisma.js';

/**
 * Returns the authenticated user's profile augmented with the derived
 * permission list. Frontend uses this as the single source of truth for
 * role/permission checks after login and on page reload.
 */
export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw AppError.unauthorized();
  const { userId, tenantId } = req.auth;

  const user = await withTenant({ tenantId }, () =>
    getPrisma().user.findFirst({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tenantId: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    }),
  );
  if (!user) throw AppError.notFound('User not found');

  ok(res, {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    emailVerified: !!user.emailVerifiedAt,
    tenantId: user.tenantId,
    tenant: user.tenant,
    permissions: Array.from(permissionsFor(user.role)),
    lastLoginAt: user.lastLoginAt,
  });
});
