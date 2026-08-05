import { Router } from 'express';

import * as ctrl from './attempt.controller.js';
import {
  ProctoringEventsBatchSchema,
  ReserveAttemptSchema,
  SaveAnswerSchema,
  SaveAnswersBatchSchema,
} from './attempt.schemas.js';

import { requireAuth } from '@/common/middleware/auth.js';
import { requirePermission } from '@/common/middleware/rbac.js';
import { tenantScope } from '@/common/middleware/tenant.js';
import { validate } from '@/common/middleware/validate.js';
import { Permission } from '@/config/constants.js';

// Two routers: `/attempts/*` for student runtime, and a sub-router mounted at
// `/exams/:id/start` for the start action (which is scoped by examId).
export const attemptRouter = Router();
attemptRouter.use(requireAuth, tenantScope);

const TAKE = requirePermission(Permission.EXAM_TAKE);

attemptRouter.post('/reserve', TAKE, validate({ body: ReserveAttemptSchema }), ctrl.reserve);
attemptRouter.get('/:id', TAKE, ctrl.detail);
attemptRouter.get('/:id/answers', TAKE, ctrl.answers);
attemptRouter.post('/:id/answers', TAKE, validate({ body: SaveAnswerSchema }), ctrl.saveAnswer);
attemptRouter.post(
  '/:id/answers/batch',
  TAKE,
  validate({ body: SaveAnswersBatchSchema }),
  ctrl.saveAnswersBatch,
);
attemptRouter.post('/:id/submit', TAKE, ctrl.submit);
attemptRouter.post(
  '/:id/proctoring-events',
  TAKE,
  validate({ body: ProctoringEventsBatchSchema }),
  ctrl.proctoringEvents,
);
attemptRouter.post('/:id/launch-token', TAKE, ctrl.launchToken);

// Exported separately so the exam router can mount it at /exams/:id/start.
export function mountStartHandler(examRouter: Router): void {
  examRouter.post('/:id/start', requireAuth, tenantScope, TAKE, ctrl.start);
}
