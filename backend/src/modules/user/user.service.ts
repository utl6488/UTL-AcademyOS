import { createHash, randomBytes } from 'node:crypto';

import { type Prisma, type UserStatus } from '@prisma/client';

import type { InviteUserInput, UpdateUserInput, UserListQuery } from './user.schemas.js';

import { AppError } from '@/common/errors/index.js';
import { env } from '@/config/env.js';
import { getPrisma } from '@/db/prisma.js';
import { sendInviteEmail } from '@/modules/auth/email.service.js';
import { hashPassword } from '@/modules/auth/password.util.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  phone: string | null;
  role: string;
  status: string;
  tenantId: string;
  classId: string | null;
  branchId: string | null;
  sectionId: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  tenant?: { id: string; name: string } | null;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  batchMemberships?: Array<{ batch: { id: string; name: string } }>;
}) {
  const firstBatch = u.batchMemberships?.[0]?.batch;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar,
    phone: u.phone,
    role: u.role,
    status: u.status,
    tenantId: u.tenantId,
    tenantName: u.tenant?.name ?? null,
    classId: u.classId,
    className: u.class?.name ?? null,
    sectionId: u.sectionId,
    sectionName: u.section?.name ?? null,
    branchId: u.branchId,
    branchName: u.branch?.name ?? null,
    batchId: firstBatch?.id ?? null,
    batchName: firstBatch?.name ?? null,
    lastLogin: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function listUsers(query: UserListQuery) {
  const where: Prisma.UserWhereInput = {};
  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;
  if (query.classId) where.classId = query.classId;
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.batchId) where.batchMemberships = { some: { batchId: query.batchId } };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.UserOrderByWithRelationInput = query.sortBy
    ? ({ [query.sortBy]: query.sortOrder } as Prisma.UserOrderByWithRelationInput)
    : { createdAt: 'desc' };

  const prisma = getPrisma();
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        tenant: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        batchMemberships: {
          include: { batch: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: rows.map(publicUser),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getUser(id: string) {
  const u = await getPrisma().user.findFirst({
    where: { id },
    include: {
      tenant: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      batchMemberships: { include: { batch: { select: { id: true, name: true } } } },
    },
  });
  if (!u) throw AppError.notFound('User not found');
  return publicUser(u);
}

export async function inviteUser(tenantId: string, input: InviteUserInput) {
  const prisma = getPrisma();
  const email = input.email.toLowerCase();

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) throw AppError.conflict('A user with that email already exists');

  // Placeholder password; user sets a real one when accepting the invite.
  const passwordHash = await hashPassword(randomBytes(24).toString('base64url'));

  const user = await prisma.user.create({
    data: {
      tenantId,
      email,
      name: input.name,
      role: input.role,
      status: 'INVITED' as UserStatus,
      passwordHash,
      classId: input.role === 'STUDENT' ? (input.classId ?? null) : null,
    },
  });

  if (input.role === 'STUDENT' && input.batchId) {
    await prisma.batchMember.create({ data: { batchId: input.batchId, userId: user.id } });
  }

  const raw = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(raw).digest('hex');
  await prisma.otpToken.create({
    data: {
      userId: user.id,
      tenantId,
      purpose: 'INVITE',
      tokenHash,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  await sendInviteEmail({
    to: user.email,
    name: user.name,
    role: user.role,
    link: `${env.APP_URL}/auth/accept-invite?token=${raw}`,
  });

  return getUser(user.id);
}

export async function updateUser(id: string, patch: UpdateUserInput) {
  const prisma = getPrisma();
  const existing = await prisma.user.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('User not found');

  // batchId lives in a join table, not on the User row — split it out.
  const { batchId, ...userPatch } = patch;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userPatch).length > 0) {
      await tx.user.update({ where: { id }, data: userPatch });
    }
    if (batchId !== undefined) {
      await tx.batchMember.deleteMany({ where: { userId: id } });
      if (batchId) {
        await tx.batchMember.create({ data: { batchId, userId: id } });
      }
    }
  });

  return getUser(id);
}

export async function setUserStatus(id: string, status: UserStatus) {
  const existing = await getPrisma().user.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('User not found');
  await getPrisma().user.update({ where: { id }, data: { status } });
  return getUser(id);
}
