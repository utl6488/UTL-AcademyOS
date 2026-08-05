import { Router } from 'express';

import * as ctrl from './question.controller.js';
import * as importCtrl from './question.import.controller.js';
import {
  QuestionCreateSchema,
  QuestionExportSchema,
  QuestionImageUploadSchema,
  QuestionImportStartSchema,
  QuestionImportUploadUrlSchema,
  QuestionUpdateSchema,
} from './question.schemas.js';

import { requireAuth } from '@/common/middleware/auth.js';
import { requirePermission } from '@/common/middleware/rbac.js';
import { tenantScope } from '@/common/middleware/tenant.js';
import { validate } from '@/common/middleware/validate.js';
import { Permission } from '@/config/constants.js';

export const questionRouter = Router();
questionRouter.use(requireAuth, tenantScope);

const READ = requirePermission(Permission.QUESTION_READ);
const MANAGE = requirePermission(Permission.QUESTION_MANAGE);

// Import/export declared BEFORE /:id so they don't get swallowed by the param.
questionRouter.post(
  '/import/upload-url',
  MANAGE,
  validate({ body: QuestionImportUploadUrlSchema }),
  importCtrl.importUploadUrl,
);
questionRouter.post(
  '/import/start',
  MANAGE,
  validate({ body: QuestionImportStartSchema }),
  importCtrl.importStart,
);
questionRouter.get('/import/:jobId', READ, importCtrl.importStatus);

questionRouter.post(
  '/export',
  READ,
  validate({ body: QuestionExportSchema }),
  importCtrl.exportCsv,
);

questionRouter.post(
  '/image/upload-url',
  MANAGE,
  validate({ body: QuestionImageUploadSchema }),
  ctrl.imageUploadUrl,
);

questionRouter.get('/', READ, ctrl.list);
questionRouter.post('/', MANAGE, validate({ body: QuestionCreateSchema }), ctrl.create);
questionRouter.get('/:id', READ, ctrl.detail);
questionRouter.put('/:id', MANAGE, validate({ body: QuestionUpdateSchema }), ctrl.update);
questionRouter.delete('/:id', MANAGE, ctrl.remove);
questionRouter.get('/:id/versions', READ, ctrl.versions);
