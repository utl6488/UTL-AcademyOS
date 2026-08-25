import { createHash, randomBytes } from 'node:crypto';

import { type OtpPurpose } from '@prisma/client';
import { type Role } from '@utl/shared';

import { AppError } from '@/common/errors/index.js';
import { permissionsFor } from '@/config/constants.js';
import { env } from '@/config/env.js';
import { getPrisma, withTenant } from '@/db/prisma.js';
import { auditFromRequest } from '@/modules/audit/audit.service.js';
import type {
  AcceptInviteInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
  VerifyEmailInput,
} from '@/modules/auth/auth.schemas.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '@/modules/auth/email.service.js';
import { hashPassword, needsRehash, verifyPassword } from '@/modules/auth/password.util.js';
import {
  issueRefreshToken,
  revokeAllUserSessions,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from '@/modules/auth/token.service.js';

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const OTP_TTL: Record<OtpPurpose, number> = {
  EMAIL_VERIFY: 24 * 60 * 60 * 1000, // 24h
  PASSWORD_RESET: 30 * 60 * 1000, // 30m
  INVITE: 7 * 24 * 60 * 60 * 1000, // 7d
  MFA: 5 * 60 * 1000, // 5m
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const hashTokenValue = (raw: string): string => createHash('sha256').update(raw).digest('hex');

const generateOtp = (): { raw: string; hash: string } => {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashTokenValue(raw) };
};

async function ensureUniqueSlug(base: string): Promise<string> {
  const prisma = getPrisma();
  const seed = base || 'institute';
  let candidate = seed;
  let n = 1;
  // Bounded retry — collisions are rare.
  while (await prisma.tenant.findUnique({ where: { slug: candidate } })) {
    candidate = `${seed}-${n++}`;
    if (n > 100) throw AppError.conflict('Could not generate unique institute slug');
  }
  return candidate;
}

/* -------------------------------------------------------------------------- */
/* Signup                                                                     */
/* -------------------------------------------------------------------------- */

export async function signup(input: SignupInput, meta: RequestMeta) {
  const prisma = getPrisma();

  // Bypass tenant middleware — this call CREATES the tenant.
  return withTenant({ tenantId: '__pending__', bypass: true }, async () => {
    const email = input.email.toLowerCase();
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) throw AppError.conflict('An account with that email already exists');

    const tenant = await prisma.tenant.create({
      data: {
        name: input.instituteName,
        slug: await ensureUniqueSlug(slugify(input.instituteName)),
      },
    });
    // Kick off a default Free subscription — the billing UI hard-depends on
    // every tenant having a subscription row.
    const { ensureFreeSubscription } = await import('@/modules/billing/billing.service.js');
    await ensureFreeSubscription(tenant.id);

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        name: input.ownerName,
        role: 'INSTITUTE_OWNER',
        status: 'ACTIVE',
      },
    });

    // Email verification OTP
    const otp = generateOtp();
    await prisma.otpToken.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        purpose: 'EMAIL_VERIFY',
        tokenHash: otp.hash,
        expiresAt: new Date(Date.now() + OTP_TTL.EMAIL_VERIFY),
      },
    });
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      link: `${env.APP_URL}/auth/verify?token=${otp.raw}`,
    });

    const refresh = await issueRefreshToken({
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
    const access = signAccessToken({
      sub: user.id,
      tid: tenant.id,
      role: user.role,
      sid: refresh.familyId,
    });

    await auditFromRequest({
      tenantId: tenant.id,
      actorId: user.id,
      action: 'auth.signup',
      targetType: 'Tenant',
      targetId: tenant.id,
      meta,
    });

    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      user: publicUser({
        ...user,
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      }),
      tokens: { access, refresh: refresh.token },
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Login                                                                      */
/* -------------------------------------------------------------------------- */

export async function login(input: LoginInput, meta: RequestMeta) {
  const prisma = getPrisma();
  const email = input.email.toLowerCase();

  return withTenant({ tenantId: '__pending__', bypass: true }, async () => {
    const user = await prisma.user.findFirst({
      where: { email },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    // Uniform failure to prevent user-enumeration timing.
    const bogusHash =
      '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR4eHh4eHg$LEuY4uV5C2u6D8T8g5fLQMuKvj8jV0YQ';
    const ok = await verifyPassword(user?.passwordHash ?? bogusHash, input.password);

    if (!user || !ok) {
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: { increment: 1 } },
        });
      }
      throw AppError.unauthorized('Invalid email or password');
    }
    if (user.status !== 'ACTIVE') {
      throw AppError.forbidden(`Account is ${user.status.toLowerCase()}`);
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw AppError.forbidden('Account is temporarily locked');
    }

    if (needsRehash(user.passwordHash)) {
      const rehashed = await hashPassword(input.password);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: rehashed },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lastLoginAt: new Date() },
    });

    const refresh = await issueRefreshToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
    const access = signAccessToken({
      sub: user.id,
      tid: user.tenantId,
      role: user.role,
      sid: refresh.familyId,
    });

    await auditFromRequest({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'auth.login',
      meta,
    });

    return { user: publicUser(user), tokens: { access, refresh: refresh.token } };
  });
}

/* -------------------------------------------------------------------------- */
/* Refresh                                                                    */
/* -------------------------------------------------------------------------- */

export async function refresh(refreshToken: string, meta: RequestMeta) {
  return withTenant({ tenantId: '__pending__', bypass: true }, async () => {
    const pair = await rotateRefreshToken(refreshToken, meta);
    return { tokens: pair };
  });
}

/* -------------------------------------------------------------------------- */
/* Logout                                                                     */
/* -------------------------------------------------------------------------- */

export async function logout(refreshToken: string) {
  return withTenant({ tenantId: '__pending__', bypass: true }, async () => {
    await revokeRefreshToken(refreshToken);
  });
}

export async function logoutEverywhere(userId: string, tenantId: string) {
  return withTenant({ tenantId, bypass: true }, async () => {
    await revokeAllUserSessions(userId);
  });
}

/* -------------------------------------------------------------------------- */
/* Email verification                                                         */
/* -------------------------------------------------------------------------- */

export async function verifyEmail(input: VerifyEmailInput) {
  const prisma = getPrisma();
  return withTenant({ tenantId: '__pending__', bypass: true }, async () => {
    const record = await prisma.otpToken.findUnique({
      where: { tokenHash: hashTokenValue(input.token) },
    });
    if (!record || record.purpose !== 'EMAIL_VERIFY') {
      throw AppError.badRequest('Invalid verification token');
    }
    if (record.usedAt) throw AppError.badRequest('Token already used');
    if (record.expiresAt.getTime() < Date.now()) throw AppError.badRequest('Token expired');
    if (!record.userId) throw AppError.badRequest('Malformed token');

    await prisma.$transaction([
      prisma.otpToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
  });
}

export async function resendVerification(email: string) {
  const prisma = getPrisma();
  return withTenant({ tenantId: '__pending__', bypass: true }, async () => {
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    if (!user || user.emailVerifiedAt) return; // silent no-op
    const otp = generateOtp();
    await prisma.otpToken.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        purpose: 'EMAIL_VERIFY',
        tokenHash: otp.hash,
        expiresAt: new Date(Date.now() + OTP_TTL.EMAIL_VERIFY),
      },
    });
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      link: `${env.APP_URL}/auth/verify?token=${otp.raw}`,
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                             */
/* -------------------------------------------------------------------------- */

export async function forgotPassword(input: ForgotPasswordInput) {
  const prisma = getPrisma();
  return withTenant({ tenantId: '__pending__', bypass: true }, async () => {
    const user = await prisma.user.findFirst({ where: { email: input.email.toLowerCase() } });
    // Always return 204 — never reveal whether the email exists.
    if (!user) return;
    const otp = generateOtp();
    await prisma.otpToken.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        purpose: 'PASSWORD_RESET',
        tokenHash: otp.hash,
        expiresAt: new Date(Date.now() + OTP_TTL.PASSWORD_RESET),
      },
    });
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      link: `${env.APP_URL}/auth/reset-password?token=${otp.raw}`,
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Invite acceptance                                                          */
/* -------------------------------------------------------------------------- */

export async function acceptInvite(input: AcceptInviteInput, meta: RequestMeta) {
  const prisma = getPrisma();
  return withTenant({ tenantId: '__pending__', bypass: true }, async () => {
    const record = await prisma.otpToken.findUnique({
      where: { tokenHash: hashTokenValue(input.token) },
    });
    if (!record || record.purpose !== 'INVITE' || !record.userId) {
      throw AppError.badRequest('Invalid invite token');
    }
    if (record.usedAt) throw AppError.badRequest('Invite already accepted');
    if (record.expiresAt.getTime() < Date.now()) throw AppError.badRequest('Invite expired');

    const user = await prisma.user.findFirst({
      where: { id: record.userId },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    if (!user) throw AppError.badRequest('Invited user no longer exists');

    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction([
      prisma.otpToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: 'ACTIVE',
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          lastLoginAt: new Date(),
        },
      }),
    ]);

    const refresh = await issueRefreshToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
    const access = signAccessToken({
      sub: user.id,
      tid: user.tenantId,
      role: user.role,
      sid: refresh.familyId,
    });

    return {
      user: publicUser({ ...user, status: 'ACTIVE', emailVerifiedAt: new Date() }),
      tokens: { access, refresh: refresh.token },
    };
  });
}

export async function resetPassword(input: ResetPasswordInput) {
  const prisma = getPrisma();
  return withTenant({ tenantId: '__pending__', bypass: true }, async () => {
    const record = await prisma.otpToken.findUnique({
      where: { tokenHash: hashTokenValue(input.token) },
    });
    if (!record || record.purpose !== 'PASSWORD_RESET' || !record.userId) {
      throw AppError.badRequest('Invalid reset token');
    }
    if (record.usedAt) throw AppError.badRequest('Token already used');
    if (record.expiresAt.getTime() < Date.now()) throw AppError.badRequest('Token expired');

    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction([
      prisma.otpToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      // Invalidate all sessions after a password reset.
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  });
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* -------------------------------------------------------------------------- */

export async function listSessions(userId: string, tenantId: string) {
  return withTenant({ tenantId }, async () => {
    const rows = await getPrisma().refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        familyId: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return rows;
  });
}

export async function revokeSession(userId: string, tenantId: string, familyId: string) {
  return withTenant({ tenantId }, async () => {
    await getPrisma().refreshToken.updateMany({
      where: { userId, familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  emailVerifiedAt: Date | null;
  status: string;
  tenant?: { id: string; name: string; slug: string } | null;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    tenantId: u.tenantId,
    emailVerified: !!u.emailVerifiedAt,
    status: u.status,
    tenant: u.tenant ?? undefined,
    permissions: Array.from(permissionsFor(u.role as Role)),
  };
}
