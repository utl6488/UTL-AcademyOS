import { Router } from 'express';

import * as ctrl from './grading.controller.js';
import { GradeInputSchema, SubmitGradesSchema } from './grading.schemas.js';

import { requireAuth } from '@/common/middleware/auth.js';
import { requirePermission } from '@/common/middleware/rbac.js';
import { tenantScope } from '@/common/middleware/tenant.js';
import { validate } from '@/common/middleware/validate.js';
import { Permission } from '@/config/constants.js';

export const gradingRouter = Router();
gradingRouter.use(requireAuth, tenantScope);

const GRADE = requirePermission(Permission.EXAM_GRADE);
const PUBLISH = requirePermission(Permission.RESULT_PUBLISH);

gradingRouter.get('/queue', GRADE, ctrl.queue);
gradingRouter.get('/exams/:examId/attempts', GRADE, ctrl.listAttemptsForExam);
gradingRouter.get('/attempts/:attemptId', GRADE, ctrl.attemptDetail);
gradingRouter.post(
  '/attempts/:attemptId/grade',
  GRADE,
  validate({ body: GradeInputSchema }),
  ctrl.gradeOne,
);
gradingRouter.post(
  '/attempts/:attemptId/submit-grades',
  GRADE,
  validate({ body: SubmitGradesSchema }),
  ctrl.submitGrades,
);
gradingRouter.post('/exams/:examId/release', PUBLISH, ctrl.release);
gradingRouter.post('/exams/:examId/unrelease', PUBLISH, ctrl.unrelease);
