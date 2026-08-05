import { Router } from 'express';

import * as ctrl from './exam.controller.js';
import { ExamCreateSchema, ExamUpdateSchema, SendWarningSchema } from './exam.schemas.js';

import { requireAuth } from '@/common/middleware/auth.js';
import { requirePermission } from '@/common/middleware/rbac.js';
import { tenantScope } from '@/common/middleware/tenant.js';
import { validate } from '@/common/middleware/validate.js';
import { Permission } from '@/config/constants.js';
import { mountStartHandler } from '@/modules/attempt/attempt.routes.js';

export const examRouter = Router();
examRouter.use(requireAuth, tenantScope);

// POST /exams/:id/start — student runtime entry point (Phase 6).
mountStartHandler(examRouter);

const READ = requirePermission(Permission.EXAM_READ);
const MANAGE = requirePermission(Permission.EXAM_MANAGE);

examRouter.get('/', READ, ctrl.list);
examRouter.post('/', MANAGE, validate({ body: ExamCreateSchema }), ctrl.create);
examRouter.get('/:id', READ, ctrl.detail);
examRouter.put('/:id', MANAGE, validate({ body: ExamUpdateSchema }), ctrl.update);
examRouter.delete('/:id', MANAGE, ctrl.remove);
examRouter.post('/:id/publish', MANAGE, ctrl.publish);
examRouter.post('/:id/unpublish', MANAGE, ctrl.unpublish);
examRouter.post('/:id/duplicate', MANAGE, ctrl.duplicate);

// Live-console (stubbed until Phase-6 attempt engine ships)
examRouter.get('/:id/live-console', READ, ctrl.liveConsole);
examRouter.post('/:id/attempts/:attemptId/force-submit', MANAGE, ctrl.forceSubmit);
examRouter.post(
  '/:id/attempts/:attemptId/send-warning',
  MANAGE,
  validate({ body: SendWarningSchema }),
  ctrl.sendWarning,
);
