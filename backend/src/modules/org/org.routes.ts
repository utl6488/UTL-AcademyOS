import { Router } from 'express';

import * as ctrl from './org.controller.js';
import {
  AcademicYearCreateSchema,
  AcademicYearUpdateSchema,
  BatchCreateSchema,
  BatchUpdateSchema,
  BranchCreateSchema,
  BranchUpdateSchema,
  ClassCreateSchema,
  ClassUpdateSchema,
  SubjectCreateSchema,
  SubjectUpdateSchema,
  TopicCreateSchema,
  TopicUpdateSchema,
} from './org.schemas.js';

import { requireAuth } from '@/common/middleware/auth.js';
import { requirePermission } from '@/common/middleware/rbac.js';
import { tenantScope } from '@/common/middleware/tenant.js';
import { validate } from '@/common/middleware/validate.js';
import { Permission } from '@/config/constants.js';

export const orgRouter = Router();
orgRouter.use(requireAuth, tenantScope);

const READ = requirePermission(Permission.ORG_READ);
const MANAGE = requirePermission(Permission.ORG_MANAGE);

// Academic Years
orgRouter.get('/academic-years', READ, ctrl.listAcademicYears);
orgRouter.post(
  '/academic-years',
  MANAGE,
  validate({ body: AcademicYearCreateSchema }),
  ctrl.createAcademicYear,
);
orgRouter.put(
  '/academic-years/:id',
  MANAGE,
  validate({ body: AcademicYearUpdateSchema }),
  ctrl.updateAcademicYear,
);
orgRouter.delete('/academic-years/:id', MANAGE, ctrl.deleteAcademicYear);

// Branches
orgRouter.get('/branches', READ, ctrl.listBranches);
orgRouter.post('/branches', MANAGE, validate({ body: BranchCreateSchema }), ctrl.createBranch);
orgRouter.put('/branches/:id', MANAGE, validate({ body: BranchUpdateSchema }), ctrl.updateBranch);
orgRouter.delete('/branches/:id', MANAGE, ctrl.deleteBranch);

// Classes
orgRouter.get('/classes', READ, ctrl.listClasses);
orgRouter.post('/classes', MANAGE, validate({ body: ClassCreateSchema }), ctrl.createClass);
orgRouter.put('/classes/:id', MANAGE, validate({ body: ClassUpdateSchema }), ctrl.updateClass);
orgRouter.delete('/classes/:id', MANAGE, ctrl.deleteClass);

// Batches
orgRouter.get('/batches', READ, ctrl.listBatches);
orgRouter.post('/batches', MANAGE, validate({ body: BatchCreateSchema }), ctrl.createBatch);
orgRouter.put('/batches/:id', MANAGE, validate({ body: BatchUpdateSchema }), ctrl.updateBatch);
orgRouter.delete('/batches/:id', MANAGE, ctrl.deleteBatch);

// Subjects
orgRouter.get('/subjects', READ, ctrl.listSubjects);
orgRouter.post('/subjects', MANAGE, validate({ body: SubjectCreateSchema }), ctrl.createSubject);
orgRouter.put('/subjects/:id', MANAGE, validate({ body: SubjectUpdateSchema }), ctrl.updateSubject);
orgRouter.delete('/subjects/:id', MANAGE, ctrl.deleteSubject);

// Topics — nested under subject
orgRouter.get('/subjects/:subjectId/topics', READ, ctrl.listTopics);
orgRouter.post(
  '/subjects/:subjectId/topics',
  MANAGE,
  validate({ body: TopicCreateSchema.omit({ subjectId: true }) }),
  ctrl.createTopic,
);
orgRouter.put('/topics/:id', MANAGE, validate({ body: TopicUpdateSchema }), ctrl.updateTopic);
orgRouter.delete('/topics/:id', MANAGE, ctrl.deleteTopic);
