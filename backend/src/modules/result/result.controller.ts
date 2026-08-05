import type { Request, Response } from 'express';

import { LeaderboardQuerySchema } from './result.schemas.js';
import * as service from './result.service.js';

import { AppError } from '@/common/errors/index.js';
import { ok, paginated } from '@/common/response.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';

function actorIdOf(req: Request): string {
  const id = req.auth?.userId;
  if (!id) throw AppError.unauthorized();
  return id;
}
function actorRoleOf(req: Request): string {
  const r = req.auth?.role;
  if (!r) throw AppError.unauthorized();
  return r;
}
function paramId(req: Request, key: string): string {
  const v = req.params[key];
  if (!v) throw AppError.badRequest(`${key} is required`);
  return v;
}

export const studentResult = asyncHandler(async (req, res: Response) => {
  ok(
    res,
    await service.getStudentResult(actorIdOf(req), actorRoleOf(req), paramId(req, 'attemptId')),
  );
});

export const leaderboard = asyncHandler(async (req, res: Response) => {
  const query = LeaderboardQuerySchema.parse(req.query);
  const result = await service.getLeaderboard(actorIdOf(req), paramId(req, 'examId'), query);
  paginated(res, result.data, result.meta.page, result.meta.pageSize, result.meta.total);
});

export const classReport = asyncHandler(async (req, res: Response) => {
  ok(res, await service.getClassReport(paramId(req, 'examId')));
});
