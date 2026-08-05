import type { Request, Response } from 'express';

import * as importSvc from './user.import.service.js';
import { UserListQuerySchema } from './user.schemas.js';
import * as service from './user.service.js';

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

export const listUsers = asyncHandler(async (req, res: Response) => {
  const query = UserListQuerySchema.parse(req.query);
  const result = await service.listUsers(query);
  paginated(res, result.data, result.meta.page, result.meta.pageSize, result.meta.total);
});

export const getUser = asyncHandler(async (req, res: Response) => {
  ok(res, await service.getUser(paramId(req, 'id')));
});

export const invite = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const user = await service.inviteUser(tenantId, req.body);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'user.invite',
    targetType: 'User',
    targetId: user.id,
    meta: { role: req.body.role, email: req.body.email },
  });
  created(res, user);
});

export const update = asyncHandler(async (req, res: Response) => {
  const id = paramId(req, 'id');
  const user = await service.updateUser(id, req.body);
  await audit({
    tenantId: tenantIdOf(req),
    actorId: actorIdOf(req),
    action: 'user.update',
    targetType: 'User',
    targetId: id,
    meta: { fields: Object.keys(req.body) },
  });
  ok(res, user);
});

export const activate = asyncHandler(async (req, res: Response) => {
  const id = paramId(req, 'id');
  const user = await service.setUserStatus(id, 'ACTIVE');
  await audit({
    tenantId: tenantIdOf(req),
    actorId: actorIdOf(req),
    action: 'user.activate',
    targetType: 'User',
    targetId: id,
  });
  ok(res, user);
});

export const deactivate = asyncHandler(async (req, res: Response) => {
  const id = paramId(req, 'id');
  const user = await service.setUserStatus(id, 'SUSPENDED');
  await audit({
    tenantId: tenantIdOf(req),
    actorId: actorIdOf(req),
    action: 'user.deactivate',
    targetType: 'User',
    targetId: id,
  });
  ok(res, user);
});

export const photoUploadUrl = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const userId = paramId(req, 'id');
  const { fileName, contentType } = req.body as { fileName: string; contentType: string };
  const upload = await createPresignedUpload({
    kind: 'photo',
    tenantId,
    fileName,
    contentType,
    subfolder: `users/${userId}`,
  });
  ok(res, { uploadUrl: upload.uploadUrl, fileUrl: upload.fileUrl });
});

// ------- Import (CSV) -------
export const importUploadUrl = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const { fileName, contentType } = req.body as { fileName: string; contentType: string };
  ok(res, await importSvc.createUploadUrl(tenantId, fileName, contentType));
});

export const importPreview = asyncHandler(async (req, res: Response) => {
  const preview = await importSvc.readAndValidateCsv(req.body.fileKey);
  // Trim the preview to the first 100 rows for the UI.
  ok(res, {
    headers: preview.headers,
    rows: preview.rows.slice(0, 100),
    totalRows: preview.totalRows,
    errors: preview.errors,
  });
});

export const importStart = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const result = await importSvc.startImport({
    tenantId,
    actorId: actorIdOf(req),
    fileKey: req.body.fileKey,
    role: req.body.role,
    classId: req.body.classId,
  });
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'user.import.start',
    targetType: 'ImportJob',
    targetId: result.jobId,
    meta: { role: req.body.role, fileKey: req.body.fileKey },
  });
  created(res, result);
});

export const importStatus = asyncHandler(async (req, res: Response) => {
  ok(res, await importSvc.getJob(paramId(req, 'jobId')));
});

export const _noop = () => noContent;
