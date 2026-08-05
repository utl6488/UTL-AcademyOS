import type { Request, Response } from 'express';

import * as service from './institute.service.js';

import { AppError } from '@/common/errors/index.js';
import { ok } from '@/common/response.js';
import { createPresignedUpload } from '@/common/s3.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';
import { audit } from '@/modules/audit/audit.service.js';

function tenantIdOf(req: Request): string {
  const tid = req.auth?.tenantId;
  if (!tid) throw AppError.unauthorized();
  return tid;
}

export const getProfile = asyncHandler(async (req, res: Response) => {
  ok(res, await service.getProfile(tenantIdOf(req)));
});

export const updateProfile = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const updated = await service.updateProfile(tenantId, req.body);
  await audit({
    tenantId,
    actorId: req.auth?.userId,
    action: 'institute.profile.update',
    targetType: 'Tenant',
    targetId: tenantId,
    meta: { fields: Object.keys(req.body) },
  });
  ok(res, updated);
});

export const createLogoUploadUrl = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const { fileName, contentType } = req.body as { fileName: string; contentType: string };
  const upload = await createPresignedUpload({
    kind: 'logo',
    tenantId,
    fileName,
    contentType,
    subfolder: 'branding',
  });
  ok(res, { uploadUrl: upload.uploadUrl, fileUrl: upload.fileUrl, fileKey: upload.fileKey });
});
