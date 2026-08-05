import { Router } from 'express';

import * as ctrl from './ai.controller.js';
import {
  AiFeedbackSchema,
  GenerateExamRequestSchema,
  GenerateQuestionsRequestSchema,
} from './ai.schemas.js';

import { requireAuth } from '@/common/middleware/auth.js';
import { requirePermission } from '@/common/middleware/rbac.js';
import { tenantScope } from '@/common/middleware/tenant.js';
import { validate } from '@/common/middleware/validate.js';
import { Permission } from '@/config/constants.js';

export const aiRouter = Router();
aiRouter.use(requireAuth, tenantScope);

const STUDENT_AI = requirePermission(Permission.AI_USE_STUDENT);
const TEACHER_AI = requirePermission(Permission.AI_USE_TEACHER);

// Student surfaces — the controller enforces "self or staff" for per-student
// endpoints. Permission is coarse (either persona can hit these).
const anyAi = (
  req: Parameters<typeof STUDENT_AI>[0],
  res: Parameters<typeof STUDENT_AI>[1],
  next: Parameters<typeof STUDENT_AI>[2],
) => {
  const role = req.auth?.role;
  if (role === 'STUDENT') return STUDENT_AI(req, res, next);
  return TEACHER_AI(req, res, next);
};

aiRouter.get('/students/:studentId/weak-topics', anyAi, ctrl.weakTopics);
aiRouter.get('/students/:studentId/study-plan', anyAi, ctrl.studyPlan);
aiRouter.post('/students/:studentId/study-plan/generate', anyAi, ctrl.generateStudyPlan);
aiRouter.get('/students/:studentId/predictions', anyAi, ctrl.predictions);
aiRouter.get('/students/:studentId/practice-questions', anyAi, ctrl.practiceQuestions);

// Teacher-only surfaces.
aiRouter.post(
  '/questions/generate',
  TEACHER_AI,
  validate({ body: GenerateQuestionsRequestSchema }),
  ctrl.generateQuestions,
);
aiRouter.post(
  '/exams/generate',
  TEACHER_AI,
  validate({ body: GenerateExamRequestSchema }),
  ctrl.generateExam,
);
aiRouter.get('/exams/:examId/class-summary', TEACHER_AI, ctrl.classSummary);
aiRouter.get('/homework/recommend', TEACHER_AI, ctrl.homeworkRecommendation);

// Feedback — either persona.
aiRouter.post('/feedback', anyAi, validate({ body: AiFeedbackSchema }), ctrl.feedback);
