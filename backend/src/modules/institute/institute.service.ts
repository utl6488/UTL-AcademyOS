import { type Prisma } from '@prisma/client';

import type { InstituteProfileUpdate } from './institute.schemas.js';

import { AppError } from '@/common/errors/index.js';
import { getPrisma } from '@/db/prisma.js';

export async function getProfile(tenantId: string) {
  const t = await getPrisma().tenant.findUnique({ where: { id: tenantId } });
  if (!t) throw AppError.notFound('Institute not found');
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    logo: t.logo,
    timezone: t.timezone,
    address: t.address,
    phone: t.phone,
    email: t.email,
    website: t.website,
    brandColor: t.brandColor,
    gradingScheme: t.gradingScheme,
    passingPercentage: t.passingPercentage,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export async function updateProfile(tenantId: string, patch: InstituteProfileUpdate) {
  const prisma = getPrisma();
  if (patch.slug) {
    const other = await prisma.tenant.findFirst({
      where: { slug: patch.slug, NOT: { id: tenantId } },
    });
    if (other) throw AppError.conflict('That slug is already in use');
  }
  const { settings, ...rest } = patch;
  const t = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...rest,
      ...(settings !== undefined ? { settings: settings as Prisma.InputJsonValue } : {}),
    },
  });
  return getProfile(t.id);
}
