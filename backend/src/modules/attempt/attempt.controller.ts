import type { Request, Response } from 'express';

import {
  ProctoringEventsBatchSchema,
  ReserveAttemptSchema,
  SaveAnswerSchema,
  SaveAnswersBatchSchema,
} from './attempt.schemas.js';
import * as service from './attempt.service.js';
import { ingestProctoringEvents } from './proctoring.service.js';

import { AppError } from '@/common/errors/index.js';
import { created, ok } from '@/common/response.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';

function tenantIdOf(req: Request): string {
  const tid = req.auth?.tenantId;
  if (!tid) throw AppError.unauthorized();
  return tid;
}
function studentIdOf(req: Request): string {
  const id = req.auth?.userId;
  if (!id) throw AppError.unauthorized();
  return id;
}
function paramId(req: Request, key: string): string {
  const v = req.params[key];
  if (!v) throw AppError.badRequest(`${key} is required`);
  return v;
}

export const reserve = asyncHandler(async (req, res: Response) => {
  const { examId } = ReserveAttemptSchema.parse(req.body);
  const r = await service.reserveAttempt(tenantIdOf(req), studentIdOf(req), examId);
  created(res, r);
});

export const start = asyncHandler(async (req, res: Response) => {
  const examId = paramId(req, 'id');
  const r = await service.startAttempt(tenantIdOf(req), studentIdOf(req), examId);
  ok(res, r);
});

export const detail = asyncHandler(async (req, res: Response) => {
  ok(res, await service.getAttempt(studentIdOf(req), paramId(req, 'id')));
});

export const answers = asyncHandler(async (req, res: Response) => {
  ok(res, await service.listAttemptAnswers(studentIdOf(req), paramId(req, 'id')));
});

export const saveAnswer = asyncHandler(async (req, res: Response) => {
  const input = SaveAnswerSchema.parse(req.body);
  ok(res, await service.saveAnswer(studentIdOf(req), paramId(req, 'id'), input));
});

export const saveAnswersBatch = asyncHandler(async (req, res: Response) => {
  const { answers } = SaveAnswersBatchSchema.parse(req.body);
  ok(res, await service.saveAnswersBatch(studentIdOf(req), paramId(req, 'id'), answers));
});

export const submit = asyncHandler(async (req, res: Response) => {
  ok(res, await service.submitAttempt(studentIdOf(req), paramId(req, 'id')));
});

export const proctoringEvents = asyncHandler(async (req, res: Response) => {
  const batch = ProctoringEventsBatchSchema.parse(req.body);
  const r = await ingestProctoringEvents(studentIdOf(req), paramId(req, 'id'), batch);
  ok(res, r);
});

// Secure browser launch token (Phase 15 stub — enough to keep the frontend happy).
export const launchToken = asyncHandler(async (req, res: Response) => {
  const attemptId = paramId(req, 'id');
  ok(res, {
    launchToken: 'STUB',
    deepLink: `utl-academyos://launch?attemptId=${attemptId}`,
    note: 'secure-browser-stub',
  });
});
