import type { Request, Response } from 'express';

import { GradeInputSchema, SubmitGradesSchema } from './grading.schemas.js';
import * as service from './grading.service.js';

import { AppError } from '@/common/errors/index.js';
import { ok } from '@/common/response.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';
import { audit } from '@/modules/audit/audit.service.js';

function tenantIdOf(req: Request): string {
  const tid = req.auth?.tenantId;
  if (!tid) throw AppError.unauthorized();
  return tid;
}
function actorIdOf(req: Request): string {
  const id = req.auth?.userId;
  if (!id) throw AppError.unauthorized();
  return id;
}
function paramId(req: Request, key: string): string {
  const v = req.params[key];
  if (!v) throw AppError.badRequest(`${key} is required`);
  return v;
}

export const queue = asyncHandler(async (_req, res: Response) => {
  ok(res, await service.listGradingQueue());
});

export const attemptDetail = asyncHandler(async (req, res: Response) => {
  ok(res, await service.getGradingAttempt(paramId(req, 'attemptId')));
});

export const listAttemptsForExam = asyncHandler(async (req, res: Response) => {
  ok(res, await service.listGradingAttemptsForExam(paramId(req, 'examId')));
});

export const gradeOne = asyncHandler(async (req, res: Response) => {
  const g = GradeInputSchema.parse(req.body);
  const tenantId = tenantIdOf(req);
  const attemptId = paramId(req, 'attemptId');
  await service.submitGrades(attemptId, actorIdOf(req), [g]);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'grading.grade',
    targetType: 'AttemptAnswer',
    targetId: attemptId,
    meta: { questionId: g.questionId, marks: g.marks },
  });
  ok(res, { ok: true });
});

export const submitGrades = asyncHandler(async (req, res: Response) => {
  const { grades } = SubmitGradesSchema.parse(req.body);
  const tenantId = tenantIdOf(req);
  const attemptId = paramId(req, 'attemptId');
  await service.submitGrades(attemptId, actorIdOf(req), grades);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'grading.submit',
    targetType: 'ExamAttempt',
    targetId: attemptId,
    meta: { count: grades.length },
  });
  ok(res, { ok: true });
});

export const release = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const examId = paramId(req, 'examId');
  const r = await service.setResultsReleased(examId, true);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'results.release',
    targetType: 'Exam',
    targetId: examId,
  });
  ok(res, r);
});

export const unrelease = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const examId = paramId(req, 'examId');
  const r = await service.setResultsReleased(examId, false);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'results.unrelease',
    targetType: 'Exam',
    targetId: examId,
  });
  ok(res, r);
});
