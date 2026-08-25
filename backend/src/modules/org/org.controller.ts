import type { Request, Response } from 'express';

import * as service from './org.service.js';

import { AppError } from '@/common/errors/index.js';
import { created, noContent, ok } from '@/common/response.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';

function tenantIdOf(req: Request): string {
  const tid = req.auth?.tenantId;
  if (!tid) throw AppError.unauthorized();
  return tid;
}

function paramId(req: Request, key: string): string {
  const v = req.params[key];
  if (!v) throw AppError.badRequest(`${key} is required`);
  return v;
}

// -------- Branches --------
export const listBranches = asyncHandler(async (req, res: Response) => {
  ok(res, await service.listBranches({ tenantId: str(req.query.tenantId) }));
});
export const createBranch = asyncHandler(async (req, res: Response) => {
  created(res, await service.createBranch({ ...req.body, tenantId: tenantIdOf(req) }));
});
export const updateBranch = asyncHandler(async (req, res: Response) => {
  ok(res, await service.updateBranch(paramId(req, 'id'), req.body));
});
export const deleteBranch = asyncHandler(async (req, res: Response) => {
  await service.deleteBranch(paramId(req, 'id'));
  noContent(res);
});

// -------- Academic Years --------
export const listAcademicYears = asyncHandler(async (_req, res: Response) => {
  ok(res, await service.listAcademicYears());
});
export const createAcademicYear = asyncHandler(async (req, res: Response) => {
  created(res, await service.createAcademicYear(tenantIdOf(req), req.body));
});
export const updateAcademicYear = asyncHandler(async (req, res: Response) => {
  ok(res, await service.updateAcademicYear(paramId(req, 'id'), req.body));
});
export const deleteAcademicYear = asyncHandler(async (req, res: Response) => {
  await service.deleteAcademicYear(paramId(req, 'id'));
  noContent(res);
});

// -------- Classes --------
export const listClasses = asyncHandler(async (req, res: Response) => {
  ok(
    res,
    await service.listClasses({
      branchId: str(req.query.branchId),
      tenantId: str(req.query.tenantId),
    }),
  );
});
export const createClass = asyncHandler(async (req, res: Response) => {
  created(res, await service.createClass(tenantIdOf(req), req.body));
});
export const updateClass = asyncHandler(async (req, res: Response) => {
  ok(res, await service.updateClass(tenantIdOf(req), paramId(req, 'id'), req.body));
});
export const deleteClass = asyncHandler(async (req, res: Response) => {
  await service.deleteClass(paramId(req, 'id'));
  noContent(res);
});

// -------- Batches --------
export const listBatches = asyncHandler(async (req, res: Response) => {
  ok(
    res,
    await service.listBatches({
      classId: str(req.query.classId),
      tenantId: str(req.query.tenantId),
    }),
  );
});
export const createBatch = asyncHandler(async (req, res: Response) => {
  created(res, await service.createBatch(tenantIdOf(req), req.body));
});
export const updateBatch = asyncHandler(async (req, res: Response) => {
  ok(res, await service.updateBatch(paramId(req, 'id'), req.body));
});
export const deleteBatch = asyncHandler(async (req, res: Response) => {
  await service.deleteBatch(paramId(req, 'id'));
  noContent(res);
});

// -------- Subjects --------
export const listSubjects = asyncHandler(async (req, res: Response) => {
  ok(
    res,
    await service.listSubjects({
      classId: str(req.query.classId),
      tenantId: str(req.query.tenantId),
    }),
  );
});
export const createSubject = asyncHandler(async (req, res: Response) => {
  created(res, await service.createSubject(tenantIdOf(req), req.body));
});
export const updateSubject = asyncHandler(async (req, res: Response) => {
  ok(res, await service.updateSubject(paramId(req, 'id'), req.body));
});
export const deleteSubject = asyncHandler(async (req, res: Response) => {
  await service.deleteSubject(paramId(req, 'id'));
  noContent(res);
});

// -------- Topics --------
export const listTopics = asyncHandler(async (req, res: Response) => {
  ok(res, await service.listTopicsForSubject(paramId(req, 'subjectId')));
});
export const createTopic = asyncHandler(async (req, res: Response) => {
  const subjectId = paramId(req, 'subjectId');
  created(res, await service.createTopic(tenantIdOf(req), { ...req.body, subjectId }));
});
export const updateTopic = asyncHandler(async (req, res: Response) => {
  ok(res, await service.updateTopic(paramId(req, 'id'), req.body));
});
export const deleteTopic = asyncHandler(async (req, res: Response) => {
  await service.deleteTopic(paramId(req, 'id'));
  noContent(res);
});

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
