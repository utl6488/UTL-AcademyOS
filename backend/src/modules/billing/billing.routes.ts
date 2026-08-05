import { Router } from 'express';

import * as ctrl from './billing.controller.js';
import { ApplyCouponSchema, CreateCheckoutSchema } from './billing.schemas.js';

import { requireAuth } from '@/common/middleware/auth.js';
import { requirePermission } from '@/common/middleware/rbac.js';
import { tenantScope } from '@/common/middleware/tenant.js';
import { validate } from '@/common/middleware/validate.js';
import { Permission } from '@/config/constants.js';

export const billingRouter = Router();
billingRouter.use(requireAuth, tenantScope);

const READ = requirePermission(Permission.BILLING_READ);
const MANAGE = requirePermission(Permission.BILLING_MANAGE);

// Plans list is public-ish (any authed tenant user can see it for upgrade UX).
billingRouter.get('/plans', READ, ctrl.listPlans);
billingRouter.get('/subscription', READ, ctrl.subscription);
billingRouter.get('/usage', READ, ctrl.usage);
billingRouter.get('/invoices', READ, ctrl.invoices);
billingRouter.get('/invoices/:id/download', READ, ctrl.downloadInvoice);

billingRouter.post('/checkout', MANAGE, validate({ body: CreateCheckoutSchema }), ctrl.checkout);
billingRouter.post(
  '/coupons/apply',
  MANAGE,
  validate({ body: ApplyCouponSchema }),
  ctrl.applyCoupon,
);
billingRouter.post('/subscription/cancel', MANAGE, ctrl.cancel);
billingRouter.post('/subscription/resume', MANAGE, ctrl.resume);
