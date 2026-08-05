import { Router } from 'express';

import * as ctrl from './result.controller.js';

import { requireAuth } from '@/common/middleware/auth.js';
import { requirePermission } from '@/common/middleware/rbac.js';
import { tenantScope } from '@/common/middleware/tenant.js';
import { Permission } from '@/config/constants.js';

export const resultRouter = Router();
resultRouter.use(requireAuth, tenantScope);

// Student result gate: RESULT_READ_OWN (students) OR RESULT_READ_ALL (staff).
// The service enforces the finer-grained "must be your own attempt + released"
// check for students; permission here is coarse.
resultRouter.get(
  '/attempts/:attemptId',
  (req, res, next) => {
    const role = req.auth?.role;
    if (role === 'STUDENT') return requirePermission(Permission.RESULT_READ_OWN)(req, res, next);
    return requirePermission(Permission.RESULT_READ_ALL)(req, res, next);
  },
  ctrl.studentResult,
);

resultRouter.get(
  '/exams/:examId/leaderboard',
  requirePermission(Permission.EXAM_READ),
  ctrl.leaderboard,
);
resultRouter.get(
  '/exams/:examId/class-report',
  requirePermission(Permission.RESULT_READ_ALL),
  ctrl.classReport,
);
