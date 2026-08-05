import { Router } from 'express';

import * as ctrl from './user.controller.js';
import {
  ImportPreviewSchema,
  ImportStartSchema,
  ImportUploadUrlSchema,
  InviteUserSchema,
  PhotoUploadUrlSchema,
  UpdateUserSchema,
} from './user.schemas.js';

import { requireAuth } from '@/common/middleware/auth.js';
import { requirePermission } from '@/common/middleware/rbac.js';
import { tenantScope } from '@/common/middleware/tenant.js';
import { validate } from '@/common/middleware/validate.js';
import { Permission } from '@/config/constants.js';

export const userRouter = Router();
userRouter.use(requireAuth, tenantScope);

const READ = requirePermission(Permission.USER_READ);
const INVITE = requirePermission(Permission.USER_INVITE);
const MANAGE = requirePermission(Permission.USER_MANAGE);

userRouter.get('/', READ, ctrl.listUsers);

// Import routes MUST be declared before `/:id` so they don't get swallowed.
userRouter.post(
  '/import/upload-url',
  INVITE,
  validate({ body: ImportUploadUrlSchema }),
  ctrl.importUploadUrl,
);
userRouter.post(
  '/import/preview',
  INVITE,
  validate({ body: ImportPreviewSchema }),
  ctrl.importPreview,
);
userRouter.post('/import/start', INVITE, validate({ body: ImportStartSchema }), ctrl.importStart);
userRouter.get('/import/:jobId', READ, ctrl.importStatus);

userRouter.post('/invite', INVITE, validate({ body: InviteUserSchema }), ctrl.invite);

userRouter.get('/:id', READ, ctrl.getUser);
userRouter.patch('/:id', MANAGE, validate({ body: UpdateUserSchema }), ctrl.update);
userRouter.patch('/:id/activate', MANAGE, ctrl.activate);
userRouter.patch('/:id/deactivate', MANAGE, ctrl.deactivate);

userRouter.post(
  '/:id/photo/upload-url',
  MANAGE,
  validate({ body: PhotoUploadUrlSchema }),
  ctrl.photoUploadUrl,
);
