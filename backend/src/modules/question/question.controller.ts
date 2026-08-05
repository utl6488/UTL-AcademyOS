import type { Request, Response } from 'express';

import { QuestionListQuerySchema } from './question.schemas.js';
import * as service from './question.service.js';

import { AppError } from '@/common/errors/index.js';
import { created, noContent, ok, paginated } from '@/common/response.js';
import { createPresignedUpload } from '@/common/s3.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';
import { audit } from '@/modules/audit/audit.service.js';

function tenantIdOf(req: Request): string {
  const tid = req.auth?.tenantId;
  if (!tid) throw AppError.unauthorized();
  return tid;
}
function actorIdOf(req: Request): string {
  const id = req.auth?.userId;
  if (!id) throw AppError.unauthorized();
  return id;
}
function paramId(req: Request, key: string): string {
  const v = req.params[key];
  if (!v) throw AppError.badRequest(`${key} is required`);
  return v;
}

export const list = asyncHandler(async (req, res: Response) => {
  const query = QuestionListQuerySchema.parse(req.query);
  const result = await service.listQuestions(query);
  paginated(res, result.data, result.meta.page, result.meta.pageSize, result.meta.total);
});

export const detail = asyncHandler(async (req, res: Response) => {
  ok(res, await service.getQuestion(paramId(req, 'id')));
});

export const create = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const q = await service.createQuestion(tenantId, actorIdOf(req), req.body);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'question.create',
    targetType: 'Question',
    targetId: q.id,
    meta: { type: q.type, subjectId: q.subjectId },
  });
  created(res, q);
});

export const update = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const id = paramId(req, 'id');
  const q = await service.updateQuestion(tenantId, actorIdOf(req), id, req.body);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'question.update',
    targetType: 'Question',
    targetId: id,
    meta: { version: q.currentVersion },
  });
  ok(res, q);
});

export const remove = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const id = paramId(req, 'id');
  await service.deleteQuestion(id);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'question.delete',
    targetType: 'Question',
    targetId: id,
  });
  noContent(res);
});

export const versions = asyncHandler(async (req, res: Response) => {
  ok(res, await service.listVersions(paramId(req, 'id')));
});

export const imageUploadUrl = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const { fileName, contentType } = req.body as { fileName: string; contentType: string };
  const upload = await createPresignedUpload({
    kind: 'question',
    tenantId,
    fileName,
    contentType,
    subfolder: 'images',
  });
  ok(res, { uploadUrl: upload.uploadUrl, fileUrl: upload.fileUrl, fileKey: upload.fileKey });
});
