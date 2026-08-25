import type { Request, Response } from 'express';

import { AppError } from '@/common/errors/index.js';
import { created, noContent, ok } from '@/common/response.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';
import * as service from '@/modules/auth/auth.service.js';

const meta = (req: Request) => ({
  ip: req.ip,
  userAgent: req.header('user-agent') ?? undefined,
});

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.signup(req.body, meta(req));
  created(res, result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.login(req.body, meta(req));
  ok(res, result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await service.refresh(refreshToken, meta(req));
  ok(res, result);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  await service.logout(refreshToken);
  noContent(res);
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw AppError.unauthorized();
  await service.logoutEverywhere(req.auth.userId, req.auth.tenantId);
  noContent(res);
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  await service.verifyEmail(req.body);
  noContent(res);
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  await service.resendVerification(req.body.email);
  noContent(res);
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await service.forgotPassword(req.body);
  noContent(res);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await service.resetPassword(req.body);
  noContent(res);
});

export const acceptInvite = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.acceptInvite(req.body, meta(req));
  ok(res, result);
});

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw AppError.unauthorized();
  const sessions = await service.listSessions(req.auth.userId, req.auth.tenantId);
  ok(res, sessions);
});

export const revokeSession = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw AppError.unauthorized();
  const familyId = req.params.familyId;
  if (!familyId) throw AppError.badRequest('familyId is required');
  await service.revokeSession(req.auth.userId, req.auth.tenantId, familyId);
  noContent(res);
});
