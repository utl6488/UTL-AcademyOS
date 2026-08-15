import type { Request, Response } from 'express';

import { ExamListQuerySchema, SendWarningSchema } from './exam.schemas.js';
import * as service from './exam.service.js';

import { AppError } from '@/common/errors/index.js';
import { created, noContent, ok, paginated } from '@/common/response.js';
import { asyncHandler } from '@/common/utils/asyncHandler.js';
import { getPrisma } from '@/db/prisma.js';
import { autoSubmitAttempt } from '@/modules/attempt/attempt.service.js';
import { computeRiskScore } from '@/modules/attempt/proctoring.service.js';
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
  const query = ExamListQuerySchema.parse(req.query);
  const result = await service.listExams(query, { role: req.auth?.role });
  paginated(res, result.data, result.meta.page, result.meta.pageSize, result.meta.total);
});

export const detail = asyncHandler(async (req, res: Response) => {
  ok(res, await service.getExam(paramId(req, 'id')));
});

export const create = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const e = await service.createExam(tenantId, actorIdOf(req), req.body);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'exam.create',
    targetType: 'Exam',
    targetId: e.id,
    meta: { title: e.title, mode: e.mode },
  });
  created(res, e);
});

export const update = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const id = paramId(req, 'id');
  const e = await service.updateExam(tenantId, id, req.body);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'exam.update',
    targetType: 'Exam',
    targetId: id,
  });
  ok(res, e);
});

export const remove = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const id = paramId(req, 'id');
  await service.deleteExam(id);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'exam.delete',
    targetType: 'Exam',
    targetId: id,
  });
  noContent(res);
});

export const publish = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const id = paramId(req, 'id');
  const e = await service.publishExam(tenantId, id);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'exam.publish',
    targetType: 'Exam',
    targetId: id,
  });
  ok(res, e);
});

export const unpublish = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const id = paramId(req, 'id');
  const e = await service.unpublishExam(id);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'exam.unpublish',
    targetType: 'Exam',
    targetId: id,
  });
  ok(res, e);
});

export const duplicate = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const id = paramId(req, 'id');
  const e = await service.duplicateExam(tenantId, actorIdOf(req), id);
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'exam.duplicate',
    targetType: 'Exam',
    targetId: id,
    meta: { copyId: e.id },
  });
  created(res, e);
});

// ---------------------------------------------------------------------------
// Live-console + attempt actions
// Return safe stubs until the Phase-6 attempt engine lands. The frontend
// polls /live-console every 5s; an empty array is a valid "no active attempts"
// response and keeps the UI functional.
// ---------------------------------------------------------------------------

export const liveConsole = asyncHandler(async (req, res: Response) => {
  const examId = paramId(req, 'id');
  const attempts = await getPrisma().examAttempt.findMany({
    where: {
      examId,
      status: { in: ['IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'LOCKED_OUT'] },
    },
    include: {
      student: { select: { id: true, name: true } },
      events: { select: { type: true, serverAt: true }, orderBy: { serverAt: 'desc' }, take: 1 },
      _count: { select: { events: true } },
    },
  });
  const rows = await Promise.all(
    attempts.map(async (a) => ({
      attemptId: a.id,
      studentId: a.student.id,
      studentName: a.student.name,
      status:
        a.status === 'IN_PROGRESS'
          ? 'in_progress'
          : a.status === 'LOCKED_OUT'
            ? 'locked_out'
            : 'submitted',
      startedAt: (a.startedAt ?? a.createdAt).toISOString(),
      violationCount: a._count.events,
      riskScore: await computeRiskScore(a.id),
      lastEvent: a.events[0]?.type ?? null,
    })),
  );
  ok(res, rows);
});

export const forceSubmit = asyncHandler(async (req, res: Response) => {
  const tenantId = tenantIdOf(req);
  const attemptId = paramId(req, 'attemptId');
  const status = await autoSubmitAttempt(attemptId, 'FORCE');
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'attempt.forceSubmit',
    targetType: 'ExamAttempt',
    targetId: attemptId,
  });
  ok(res, { status });
});

export const sendWarning = asyncHandler(async (req, res: Response) => {
  const { message } = SendWarningSchema.parse(req.body);
  const tenantId = tenantIdOf(req);
  const attemptId = paramId(req, 'attemptId');
  await getPrisma().attemptEvent.create({
    data: {
      tenantId,
      attemptId,
      type: 'WARNING_SENT',
      meta: { message, from: actorIdOf(req) },
    },
  });
  await audit({
    tenantId,
    actorId: actorIdOf(req),
    action: 'attempt.warn',
    targetType: 'ExamAttempt',
    targetId: attemptId,
    meta: { message },
  });
  ok(res, { ok: true });
});
