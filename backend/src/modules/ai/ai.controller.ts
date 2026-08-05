import type { Request, Response } from 'express';

import {
  AiFeedbackSchema,
  GenerateExamRequestSchema,
  GenerateQuestionsRequestSchema,
  HomeworkRecommendationQuerySchema,
} from './ai.schemas.js';
import * as service from './ai.service.js';

import { AppError } from '@/common/errors/index.js';
import { created, ok } from '@/common/response.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';

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

// Students can only fetch their own AI surfaces. Staff can fetch anyone's
// (used by teacher dashboards).
function assertSelfOrStaff(req: Request, studentId: string): void {
  const role = req.auth?.role;
  if (role === 'STUDENT' && req.auth?.userId !== studentId) {
    throw AppError.forbidden();
  }
}

export const weakTopics = asyncHandler(async (req, res: Response) => {
  const studentId = paramId(req, 'studentId');
  assertSelfOrStaff(req, studentId);
  ok(res, await service.getWeakTopics(studentId));
});

export const studyPlan = asyncHandler(async (req, res: Response) => {
  const studentId = paramId(req, 'studentId');
  assertSelfOrStaff(req, studentId);
  ok(res, await service.getStudyPlan(studentId));
});

export const generateStudyPlan = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const studentId = paramId(req, 'studentId');
  assertSelfOrStaff(req, studentId);
  ok(res, await service.generateStudyPlan(tenantId, studentId));
});

export const predictions = asyncHandler(async (req, res: Response) => {
  const studentId = paramId(req, 'studentId');
  assertSelfOrStaff(req, studentId);
  ok(res, await service.getPredictions(studentId));
});

export const practiceQuestions = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const studentId = paramId(req, 'studentId');
  assertSelfOrStaff(req, studentId);
  const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 10)));
  const topicId = typeof req.query.topicId === 'string' ? req.query.topicId : undefined;
  ok(res, await service.recommendPracticeQuestions(tenantId, studentId, { limit, topicId }));
});

export const generateQuestions = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const input = GenerateQuestionsRequestSchema.parse(req.body);
  ok(res, await service.generateQuestions(tenantId, input));
});

export const generateExam = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const input = GenerateExamRequestSchema.parse(req.body);
  created(res, await service.generateExam(tenantId, actorIdOf(req), input));
});

export const classSummary = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const examId = paramId(req, 'examId');
  ok(res, await service.generateClassSummary(tenantId, examId));
});

export const homeworkRecommendation = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const query = HomeworkRecommendationQuerySchema.parse(req.query);
  ok(res, await service.recommendHomework(tenantId, query));
});

export const feedback = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const input = AiFeedbackSchema.parse(req.body);
  ok(res, await service.submitFeedback(tenantId, actorIdOf(req), input));
});
