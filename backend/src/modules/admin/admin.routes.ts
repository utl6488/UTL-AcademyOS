import { Router } from 'express';

import * as ctrl from './admin.controller.js';
import {
  CreateFeatureFlagSchema,
  OverridePlanSchema,
  UpdateFeatureFlagSchema,
} from './admin.schemas.js';

import { requireAuth } from '@/common/middleware/auth.js';
import { requireRole } from '@/common/middleware/rbac.js';
import { tenantScope } from '@/common/middleware/tenant.js';
import { validate } from '@/common/middleware/validate.js';

export const adminRouter = Router();

// SUPER_ADMIN only. `tenantScope` runs in bypass mode for SUPER_ADMIN when no
// `x-tenant-id` header is supplied — this is what enables cross-tenant reads
// through the Prisma tenant middleware.
adminRouter.use(requireAuth, requireRole('SUPER_ADMIN'), tenantScope);

// Tenants
adminRouter.get('/tenants', ctrl.listTenants);
adminRouter.get('/tenants/:id', ctrl.getTenant);
adminRouter.post('/tenants/:id/suspend', ctrl.suspendTenant);
adminRouter.post('/tenants/:id/reactivate', ctrl.reactivateTenant);
adminRouter.post(
  '/tenants/:id/override-plan',
  validate({ body: OverridePlanSchema }),
  ctrl.overrideTenantPlan,
);

// Revenue
adminRouter.get('/revenue', ctrl.revenue);

// Feature flags
adminRouter.get('/feature-flags', ctrl.listFlags);
adminRouter.post('/feature-flags', validate({ body: CreateFeatureFlagSchema }), ctrl.createFlag);
adminRouter.patch(
  '/feature-flags/:id',
  validate({ body: UpdateFeatureFlagSchema }),
  ctrl.updateFlag,
);
adminRouter.delete('/feature-flags/:id', ctrl.deleteFlag);

// System health
adminRouter.get('/health', ctrl.health);
