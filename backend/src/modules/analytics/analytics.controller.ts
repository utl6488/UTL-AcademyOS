import type { Response } from 'express';

import * as service from './analytics.service.js';

import { AppError } from '@/common/errors/index.js';
import { ok } from '@/common/response.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';

export const dashboard = asyncHandler(async (_req, res: Response) => {
  ok(res, await service.getInstituteDashboard());
});

export const batchTrends = asyncHandler(async (req, res: Response) => {
  const batchId = req.params.batchId;
  if (!batchId) throw AppError.badRequest('batchId is required');
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  ok(res, await service.getBatchTrends(batchId, { limit }));
});
