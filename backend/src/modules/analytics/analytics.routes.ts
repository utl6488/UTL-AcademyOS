import { Router } from 'express';

import * as ctrl from './analytics.controller.js';

import { requireAuth } from '@/common/middleware/auth.js';
import { requirePermission } from '@/common/middleware/rbac.js';
import { tenantScope } from '@/common/middleware/tenant.js';
import { Permission } from '@/config/constants.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, tenantScope);

analyticsRouter.get('/dashboard', requirePermission(Permission.RESULT_READ_ALL), ctrl.dashboard);
analyticsRouter.get(
  '/batches/:batchId/trends',
  requirePermission(Permission.RESULT_READ_ALL),
  ctrl.batchTrends,
);
