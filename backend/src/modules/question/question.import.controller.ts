import type { Request, Response } from 'express';

import * as service from './question.import.service.js';

import { AppError } from '@/common/errors/index.js';
import { created, ok } from '@/common/response.js';
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

export const importUploadUrl = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const { fileName, contentType } = req.body as { fileName: string; contentType: string };
  ok(res, await service.createUploadUrl(tenantId, fileName, contentType));
});

export const importStart = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const result = await service.startImport({
    tenantId,
    actorId: actorIdOf(req),
    fileKey: req.body.fileKey,
  });
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'question.import.start',
    targetType: 'ImportJob',
    targetId: result.jobId,
    meta: { fileKey: req.body.fileKey },
  });
  created(res, result);
});

export const importStatus = asyncHandler(async (req, res: Response) => {
  ok(res, await service.getJob(paramId(req, 'jobId')));
});

export const exportCsv = asyncHandler(async (req, res: Response) => {
  const csv = await service.exportQuestions(req.body ?? {});
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="questions-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.status(200).send(csv);
});
