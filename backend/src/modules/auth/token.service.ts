import { createHash, randomBytes } from 'node:crypto';

import type { Role } from '@utl/shared';
import * as jwt from 'jsonwebtoken';
import { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import { nanoid } from 'nanoid';

import { AppError } from '@/common/errors/index.js';
import { env } from '@/config/env.js';
import { prisma } from '@/db/prisma.js';

export interface AccessTokenPayload {
  sub: string; // user id
  tid: string; // tenant id
  role: Role;
  sid: string; // session (refresh-token family) id
}

interface RefreshTokenClaims extends AccessTokenPayload {
  jti: string;
  fam: string;
}

interface IssueRefreshOptions {
  userId: string;
  tenantId: string;
  role: Role;
  familyId?: string;
  userAgent?: string;
  ip?: string;
}

const ACCESS_OPTS: SignOptions = {
  algorithm: 'HS256',
  expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
};
const REFRESH_OPTS: SignOptions = {
  algorithm: 'HS256',
  expiresIn: env.JWT_REFRESH_TTL as SignOptions['expiresIn'],
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, ACCESS_OPTS);
}

export function verifyAccessToken(token: string): AccessTokenPayload & JwtPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload & JwtPayload;
  } catch {
    throw AppError.unauthorized('Invalid or expired access token');
  }
}

function signRefreshToken(claims: RefreshTokenClaims): string {
  return jwt.sign(claims, env.JWT_REFRESH_SECRET, { ...REFRESH_OPTS, jwtid: claims.jti });
}

function verifyRefreshToken(token: string): RefreshTokenClaims & JwtPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenClaims & JwtPayload;
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }
}

const hashToken = (raw: string): string => createHash('sha256').update(raw).digest('hex');

function refreshExpiresAt(): Date {
  // JWT_REFRESH_TTL is a duration string ("7d", "12h"). Compute the DB expiry
  // by decoding a throwaway token instead of parsing the duration ourselves.
  const dummy = jwt.sign({}, env.JWT_REFRESH_SECRET, REFRESH_OPTS);
  const decoded = jwt.decode(dummy) as JwtPayload;
  return new Date((decoded.exp ?? Math.floor(Date.now() / 1000) + 3600) * 1000);
}

/**
 * Create a new refresh-token row + signed JWT. `familyId` groups the rotation
 * chain — omit to start a fresh family (new login).
 */
export async function issueRefreshToken(
  opts: IssueRefreshOptions,
): Promise<{ token: string; familyId: string; tokenId: string }> {
  const tokenId = nanoid(24);
  const familyId = opts.familyId ?? nanoid(24);
  const raw = randomBytes(48).toString('base64url');
  const jwtStr = signRefreshToken({
    sub: opts.userId,
    tid: opts.tenantId,
    role: opts.role,
    sid: familyId,
    fam: familyId,
    jti: tokenId,
  });

  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      tenantId: opts.tenantId,
      userId: opts.userId,
      tokenHash: hashToken(`${jwtStr}.${raw}`),
      familyId,
      expiresAt: refreshExpiresAt(),
      userAgent: opts.userAgent,
      ip: opts.ip,
    },
  });

  // Concatenated form is what clients send back; we store its hash.
  return { token: `${jwtStr}.${raw}`, familyId, tokenId };
}

/**
 * Rotate a refresh token. Validates the presented token, revokes it, and
 * issues a fresh pair in the same family. If a revoked token is re-used, the
 * entire family is revoked — a signal of theft.
 */
export async function rotateRefreshToken(
  presented: string,
  meta: { userAgent?: string; ip?: string },
): Promise<{ access: string; refresh: string }> {
  const [jwtPart, rawPart] =
    presented.split('.').length >= 4
      ? [
          presented.slice(0, presented.lastIndexOf('.')),
          presented.slice(presented.lastIndexOf('.') + 1),
        ]
      : [presented, ''];
  if (!rawPart) throw AppError.unauthorized('Malformed refresh token');
  const claims = verifyRefreshToken(jwtPart);
  const presentedHash = hashToken(presented);

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: presentedHash },
    include: { user: true },
  });
  if (!record) throw AppError.unauthorized('Unknown refresh token');
  if (record.userId !== claims.sub || record.tenantId !== claims.tid) {
    throw AppError.unauthorized('Refresh token / claim mismatch');
  }

  if (record.revokedAt) {
    // Reuse of a revoked token → likely theft. Revoke the whole family.
    await prisma.refreshToken.updateMany({
      where: { familyId: record.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw AppError.unauthorized('Refresh token reuse detected; sessions revoked');
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw AppError.unauthorized('Refresh token expired');
  }

  const issued = await issueRefreshToken({
    userId: record.userId,
    tenantId: record.tenantId,
    role: record.user.role,
    familyId: record.familyId,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date(), replacedById: issued.tokenId },
  });

  const access = signAccessToken({
    sub: record.userId,
    tid: record.tenantId,
    role: record.user.role,
    sid: record.familyId,
  });

  return { access, refresh: issued.token };
}

/** Revoke a single refresh token (logout of one session). */
export async function revokeRefreshToken(presented: string): Promise<void> {
  const hash = hashToken(presented);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoke every refresh token for a user (logout everywhere). */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoke by family id (targeted session logout). */
export async function revokeSession(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
