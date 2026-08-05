import { Router } from 'express';

import * as ctrl from './institute.controller.js';
import { InstituteProfileUpdateSchema, LogoUploadUrlSchema } from './institute.schemas.js';

import { requireAuth } from '@/common/middleware/auth.js';
import { requirePermission } from '@/common/middleware/rbac.js';
import { tenantScope } from '@/common/middleware/tenant.js';
import { validate } from '@/common/middleware/validate.js';
import { Permission } from '@/config/constants.js';

export const instituteRouter = Router();

instituteRouter.use(requireAuth, tenantScope);

instituteRouter.get('/profile', requirePermission(Permission.INSTITUTE_READ), ctrl.getProfile);

instituteRouter.put(
  '/profile',
  requirePermission(Permission.INSTITUTE_MANAGE),
  validate({ body: InstituteProfileUpdateSchema }),
  ctrl.updateProfile,
);

instituteRouter.patch(
  '/profile',
  requirePermission(Permission.INSTITUTE_MANAGE),
  validate({ body: InstituteProfileUpdateSchema }),
  ctrl.updateProfile,
);

instituteRouter.post(
  '/logo/upload-url',
  requirePermission(Permission.INSTITUTE_MANAGE),
  validate({ body: LogoUploadUrlSchema }),
  ctrl.createLogoUploadUrl,
);
