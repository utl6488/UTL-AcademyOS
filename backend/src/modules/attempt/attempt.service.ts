import { createHash, randomBytes } from 'node:crypto';

import { Prisma, type AttemptStatus, type ExamAttempt } from '@prisma/client';

import type { SaveAnswerInput } from './attempt.schemas.js';

import { AppError } from '@/common/errors/index.js';
import { getPrisma } from '@/db/prisma.js';
import { enqueueEvaluate } from '@/jobs/evaluate.queue.js';
import { enqueueAutoSubmit } from '@/jobs/exam.queue.js';
import { emitAttemptSubmitted } from '@/sockets/emit.js';

// ---------------------------------------------------------------------------
// Deterministic shuffle (Fisher-Yates seeded by hash of seed + counter)
// Same seed → identical order across replays, essential for anti-cheat audit
// and for the "resume" path (student rejoins and sees the same layout).
// ---------------------------------------------------------------------------

function seededRandom(seed: string): () => number {
  let counter = 0;
  return () => {
    const h = createHash('sha256').update(`${seed}:${counter++}`).digest();
    // Take first 4 bytes as unsigned int, normalize to [0,1)
    return h.readUInt32BE(0) / 0x100000000;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

async function toAttemptInfo(attempt: ExamAttempt) {
  const prisma = getPrisma();
  const exam = await prisma.exam.findFirst({
    where: { id: attempt.examId },
    include: {
      sections: { orderBy: { order: 'asc' } },
      questions: { include: { question: true } },
    },
  });
  if (!exam) throw AppError.notFound('Exam not found');

  const orderMap = new Map<string, number>();
  if (Array.isArray(attempt.questionOrder)) {
    (attempt.questionOrder as Array<{ questionId: string; order: number }>).forEach((q) => {
      orderMap.set(q.questionId, q.order);
    });
  }

  const questionsBySection = new Map<string | null, typeof exam.questions>();
  for (const eq of exam.questions) {
    const key = eq.sectionId ?? null;
    const list = questionsBySection.get(key) ?? [];
    list.push(eq);
    questionsBySection.set(key, list);
  }

  const sections = exam.sections.map((s) => {
    const items = (questionsBySection.get(s.id) ?? []).slice().sort((a, b) => {
      const oa = orderMap.get(a.questionId) ?? a.order;
      const ob = orderMap.get(b.questionId) ?? b.order;
      return oa - ob;
    });
    return {
      id: s.id,
      title: s.title,
      questions: items.map((eq) =>
        renderExamQuestion(eq, exam.shuffleOptions, attempt.shuffleSeed),
      ),
    };
  });

  // If the exam has no sections, emit a single synthetic "Main" bucket.
  if (sections.length === 0 && exam.questions.length) {
    const items = exam.questions.slice().sort((a, b) => {
      const oa = orderMap.get(a.questionId) ?? a.order;
      const ob = orderMap.get(b.questionId) ?? b.order;
      return oa - ob;
    });
    sections.push({
      id: '__main',
      title: 'Main',
      questions: items.map((eq) =>
        renderExamQuestion(eq, exam.shuffleOptions, attempt.shuffleSeed),
      ),
    });
  }

  const proctoring = (exam.proctoring ?? {}) as Record<string, unknown>;

  return {
    id: attempt.id,
    examId: exam.id,
    examTitle: exam.title,
    status: attempt.status,
    mode: exam.mode,
    startedAt: attempt.startedAt?.toISOString() ?? null,
    endsAt: attempt.endsAt?.toISOString() ?? null,
    startAt: exam.startAt?.toISOString() ?? null,
    durationMinutes: exam.durationMinutes,
    totalMarks: exam.totalMarks,
    lateEntryGraceMs: exam.lateEntryGraceMs,
    lockdownOnLate: exam.lockdownOnLate,
    instructions: exam.instructions,
    // Secure-browser fields (Phase 15) — safe defaults for now.
    requireSecureBrowser: Boolean(proctoring.requireSecureBrowser),
    attestedBy: 'WEB' as const,
    proctoring: {
      requireFullscreen: Boolean(proctoring.requireFullscreen ?? true),
      fullscreenExitPolicy: (proctoring.fullscreenExitPolicy as string) ?? 'warn_then_submit',
      fullscreenMaxWarnings: Number(proctoring.fullscreenMaxWarnings ?? 3),
      tabSwitchPolicy: (proctoring.tabSwitchPolicy as string) ?? 'warn_then_submit',
      tabSwitchMaxWarnings: Number(proctoring.tabSwitchMaxWarnings ?? 3),
      disableCopy: Boolean(proctoring.disableCopy ?? true),
      disablePaste: Boolean(proctoring.disablePaste ?? true),
      disableRightClick: Boolean(proctoring.disableRightClick ?? true),
      disablePrint: Boolean(proctoring.disablePrint ?? true),
      disableDevtools: Boolean(proctoring.disableDevtools ?? true),
      blockMultipleDisplays: Boolean(proctoring.blockMultipleDisplays ?? false),
    },
    sections,
  };
}

interface RenderedQ {
  id: string;
  questionId: string;
  text: string;
  type: string;
  marks: number;
  options: Array<{ id: string; text: string }> | null;
  imageUrl: string | null;
  blanksCount: number | null;
  unit: string | null;
}

function renderExamQuestion(
  eq: {
    id: string;
    questionId: string;
    marksOverride: number | null;
    question: { text: string; type: string; marks: number; content: unknown };
  },
  shuffleOptions: boolean,
  seed: string | null,
): RenderedQ {
  const content = (eq.question.content ?? {}) as Record<string, unknown>;
  const rawOpts = Array.isArray(content.options)
    ? (content.options as Array<{ id: string; text: string; isCorrect: boolean }>)
    : null;
  // Strip `isCorrect` before returning to the client — never leak the key.
  let opts = rawOpts ? rawOpts.map((o) => ({ id: o.id, text: o.text })) : null;
  if (opts && shuffleOptions && seed) {
    const rng = seededRandom(`${seed}:${eq.id}`);
    opts = shuffleInPlace(opts.slice(), rng);
  }
  const blanks = Array.isArray(content.blanks) ? (content.blanks as string[]).length : null;
  const unit = typeof content.unit === 'string' ? content.unit : null;
  const imageUrl = typeof content.imageUrl === 'string' ? content.imageUrl : null;

  return {
    id: eq.id,
    questionId: eq.questionId,
    text: eq.question.text,
    type: eq.question.type,
    marks: eq.marksOverride ?? eq.question.marks,
    options: opts,
    imageUrl,
    blanksCount: blanks,
    unit,
  };
}

// ---------------------------------------------------------------------------
// Access checks
// ---------------------------------------------------------------------------

async function assertAssigned(examId: string, studentId: string): Promise<void> {
  const prisma = getPrisma();
  const student = await prisma.user.findFirst({
    where: { id: studentId },
    select: { classId: true, batchMemberships: { select: { batchId: true } } },
  });
  if (!student) throw AppError.notFound('Student not found');

  const batchIds = student.batchMemberships.map((m) => m.batchId);
  const assigned = await prisma.examAssignment.findFirst({
    where: {
      examId,
      OR: [
        { studentId },
        student.classId ? { classId: student.classId } : { classId: '__nope' },
        ...(batchIds.length ? [{ batchId: { in: batchIds } }] : []),
      ],
    },
    select: { id: true },
  });
  if (!assigned) throw AppError.forbidden('You are not assigned to this exam');
}

// ---------------------------------------------------------------------------
// Reserve — pre-registers the attempt row a few minutes before startAt.
// Spreads DB writes so start-burst doesn't hammer Postgres.
// ---------------------------------------------------------------------------

export async function reserveAttempt(tenantId: string, studentId: string, examId: string) {
  await assertAssigned(examId, studentId);
  const prisma = getPrisma();
  const exam = await prisma.exam.findFirst({ where: { id: examId }, include: { questions: true } });
  if (!exam) throw AppError.notFound('Exam not found');
  if (exam.status === 'DRAFT') throw AppError.badRequest('Exam is not yet published');

  const existing = await prisma.examAttempt.findFirst({ where: { examId, studentId } });
  if (existing) return { attemptId: existing.id };

  const seed = randomBytes(16).toString('hex');
  const order = computeShuffledOrder(exam, seed);

  const attempt = await prisma.examAttempt.create({
    data: {
      tenantId,
      examId,
      studentId,
      status: 'RESERVED',
      reservedAt: new Date(),
      shuffleSeed: seed,
      questionOrder: order as Prisma.InputJsonValue,
    },
  });
  return { attemptId: attempt.id };
}

// ---------------------------------------------------------------------------
// Start — kicks off the server-side clock. Idempotent.
// ---------------------------------------------------------------------------

export async function startAttempt(tenantId: string, studentId: string, examId: string) {
  await assertAssigned(examId, studentId);
  const prisma = getPrisma();
  const exam = await prisma.exam.findFirst({ where: { id: examId }, include: { questions: true } });
  if (!exam) throw AppError.notFound('Exam not found');
  if (exam.status === 'DRAFT') throw AppError.badRequest('Exam is not yet published');
  if (exam.status === 'COMPLETED' || exam.status === 'CANCELLED') {
    throw AppError.conflict('Exam is no longer available');
  }

  const now = new Date();
  let attempt = await prisma.examAttempt.findFirst({ where: { examId, studentId } });

  // Idempotent: if already in progress, just return it.
  if (attempt && attempt.status === 'IN_PROGRESS') {
    return { attemptId: attempt.id, status: attempt.status };
  }
  if (
    attempt &&
    (attempt.status === 'SUBMITTED' ||
      attempt.status === 'AUTO_SUBMITTED' ||
      attempt.status === 'EVALUATED')
  ) {
    throw AppError.conflict('Attempt already submitted');
  }
  if (attempt && attempt.status === 'LOCKED_OUT') {
    throw AppError.forbidden('Late-entry window has closed');
  }

  // Late-entry / lockdown gate (SYNCHRONOUS only).
  if (exam.mode === 'SYNCHRONOUS' && exam.startAt) {
    const startMs = exam.startAt.getTime();
    const nowMs = now.getTime();
    const grace = exam.lateEntryGraceMs ?? 0;
    if (nowMs < startMs) {
      // Not yet startable — student should be in the lobby.
      throw AppError.badRequest('Exam has not started yet');
    }
    if (nowMs > startMs + grace && exam.lockdownOnLate) {
      if (attempt) {
        await prisma.examAttempt.update({
          where: { id: attempt.id },
          data: { status: 'LOCKED_OUT' },
        });
      }
      throw AppError.forbidden('Late-entry window has closed');
    }
  }

  // Compute endsAt.
  const endsAt =
    exam.mode === 'SYNCHRONOUS' && exam.startAt
      ? new Date(exam.startAt.getTime() + exam.durationMinutes * 60_000)
      : new Date(now.getTime() + exam.durationMinutes * 60_000);

  if (endsAt.getTime() <= now.getTime()) {
    throw AppError.conflict('Exam has already ended');
  }

  // Create-or-promote-to-IN_PROGRESS.
  if (!attempt) {
    const seed = randomBytes(16).toString('hex');
    const order = computeShuffledOrder(exam, seed);
    attempt = await prisma.examAttempt.create({
      data: {
        tenantId,
        examId,
        studentId,
        status: 'IN_PROGRESS',
        startedAt: now,
        endsAt,
        reservedAt: now,
        shuffleSeed: seed,
        questionOrder: order as Prisma.InputJsonValue,
      },
    });
  } else {
    attempt = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { status: 'IN_PROGRESS', startedAt: now, endsAt },
    });
  }

  // Delayed auto-submit at endsAt. For SYNCHRONOUS the correct-shape thing is a
  // single mass-job (Phase B10.a); the per-student delayed job here works fine
  // for MVP and is cheap to replace later.
  await enqueueAutoSubmit(
    { tenantId, attemptId: attempt.id },
    Math.max(0, endsAt.getTime() - now.getTime()),
  );

  return { attemptId: attempt.id, status: attempt.status };
}

function computeShuffledOrder(
  exam: { shuffleQuestions: boolean; questions: Array<{ questionId: string; order: number }> },
  seed: string,
) {
  const list = exam.questions.map((q) => ({ questionId: q.questionId, order: q.order }));
  if (!exam.shuffleQuestions) return list;
  const rng = seededRandom(seed);
  const shuffled = shuffleInPlace(list.slice(), rng);
  return shuffled.map((q, i) => ({ questionId: q.questionId, order: i }));
}

// ---------------------------------------------------------------------------
// Get attempt (+ remainingMs) — student's rehydration path
// ---------------------------------------------------------------------------

export async function getAttempt(studentId: string, attemptId: string) {
  const prisma = getPrisma();
  const attempt = await prisma.examAttempt.findFirst({ where: { id: attemptId } });
  if (!attempt) throw AppError.notFound('Attempt not found');
  if (attempt.studentId !== studentId) throw AppError.forbidden();
  return toAttemptInfo(attempt);
}

export async function getAttemptById(attemptId: string) {
  const attempt = await getPrisma().examAttempt.findFirst({ where: { id: attemptId } });
  if (!attempt) throw AppError.notFound('Attempt not found');
  return toAttemptInfo(attempt);
}

export async function listAttemptAnswers(studentId: string, attemptId: string) {
  const prisma = getPrisma();
  const attempt = await prisma.examAttempt.findFirst({ where: { id: attemptId } });
  if (!attempt) throw AppError.notFound('Attempt not found');
  if (attempt.studentId !== studentId) throw AppError.forbidden();
  const answers = await prisma.attemptAnswer.findMany({ where: { attemptId } });
  return answers.map((a) => ({
    questionId: a.questionId,
    answer: a.answer,
    isMarked: a.isMarked,
    answeredAt: a.answeredAt?.toISOString() ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Save answer(s) — idempotent by (attemptId, questionId, clientRevision)
// ---------------------------------------------------------------------------

async function assertWritable(attempt: ExamAttempt): Promise<void> {
  if (attempt.status !== 'IN_PROGRESS') {
    throw AppError.conflict(`Attempt is ${attempt.status}, no longer accepting writes`);
  }
  if (attempt.endsAt && attempt.endsAt.getTime() < Date.now()) {
    throw AppError.conflict('Attempt time has expired');
  }
}

export async function saveAnswer(studentId: string, attemptId: string, input: SaveAnswerInput) {
  const prisma = getPrisma();
  const attempt = await prisma.examAttempt.findFirst({ where: { id: attemptId } });
  if (!attempt) throw AppError.notFound('Attempt not found');
  if (attempt.studentId !== studentId) throw AppError.forbidden();
  await assertWritable(attempt);

  // Verify question belongs to this attempt's exam.
  const eq = await prisma.examQuestion.findFirst({
    where: { examId: attempt.examId, questionId: input.questionId },
    select: { id: true },
  });
  if (!eq) throw AppError.badRequest('Question is not part of this exam');

  const existing = await prisma.attemptAnswer.findFirst({
    where: { attemptId, questionId: input.questionId },
    select: { clientRevision: true },
  });
  // Idempotent: drop older or duplicate writes.
  if (existing && existing.clientRevision >= input.clientRevision) {
    return { ok: true, dropped: true };
  }

  await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId: input.questionId } },
    create: {
      tenantId: attempt.tenantId,
      attemptId,
      questionId: input.questionId,
      answer: (input.answer ?? Prisma.DbNull) as Prisma.InputJsonValue,
      isMarked: input.isMarked,
      clientRevision: input.clientRevision,
      timeSpentMs: input.timeSpentMs,
      answeredAt: input.answeredAt ? new Date(input.answeredAt) : new Date(),
    },
    update: {
      answer: (input.answer ?? Prisma.DbNull) as Prisma.InputJsonValue,
      isMarked: input.isMarked,
      clientRevision: input.clientRevision,
      timeSpentMs: input.timeSpentMs,
      answeredAt: input.answeredAt ? new Date(input.answeredAt) : new Date(),
    },
  });
  return { ok: true };
}

export async function saveAnswersBatch(
  studentId: string,
  attemptId: string,
  answers: SaveAnswerInput[],
) {
  let saved = 0;
  let dropped = 0;
  for (const a of answers) {
    const res = await saveAnswer(studentId, attemptId, a);
    if (res.dropped) dropped++;
    else saved++;
  }
  return { saved, dropped };
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

export async function submitAttempt(studentId: string, attemptId: string) {
  const prisma = getPrisma();
  const attempt = await prisma.examAttempt.findFirst({ where: { id: attemptId } });
  if (!attempt) throw AppError.notFound('Attempt not found');
  if (attempt.studentId !== studentId) throw AppError.forbidden();
  if (
    attempt.status === 'SUBMITTED' ||
    attempt.status === 'AUTO_SUBMITTED' ||
    attempt.status === 'EVALUATED'
  ) {
    return { status: attempt.status };
  }
  if (attempt.status !== 'IN_PROGRESS') {
    throw AppError.conflict(`Cannot submit from status ${attempt.status}`);
  }

  const updated = await prisma.examAttempt.update({
    where: { id: attemptId },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });
  await enqueueEvaluate({ attemptId: updated.id, tenantId: updated.tenantId });
  emitAttemptSubmitted({
    attemptId: updated.id,
    examId: updated.examId,
    studentId: updated.studentId,
    status: 'SUBMITTED',
    reason: 'STUDENT',
    at: Date.now(),
  });
  return { status: updated.status };
}

/// Called by the delayed BullMQ job at endsAt, or by the proctoring policy
/// evaluator when a violation threshold trips.
export async function autoSubmitAttempt(
  attemptId: string,
  reason: 'TIME_UP' | 'POLICY' | 'FORCE',
): Promise<AttemptStatus> {
  const prisma = getPrisma();
  const attempt = await prisma.examAttempt.findFirst({ where: { id: attemptId } });
  if (!attempt) return 'NOT_STARTED';
  if (attempt.status !== 'IN_PROGRESS') return attempt.status;

  const updated = await prisma.examAttempt.update({
    where: { id: attemptId },
    data: { status: 'AUTO_SUBMITTED', submittedAt: new Date() },
  });
  await prisma.attemptEvent.create({
    data: {
      tenantId: attempt.tenantId,
      attemptId,
      type: reason === 'FORCE' ? 'FORCE_SUBMITTED' : 'WARNING_SENT',
      meta: { reason },
    },
  });
  await enqueueEvaluate({ attemptId: updated.id, tenantId: updated.tenantId });
  emitAttemptSubmitted({
    attemptId: updated.id,
    examId: updated.examId,
    studentId: updated.studentId,
    status: 'AUTO_SUBMITTED',
    reason,
    at: Date.now(),
  });
  return updated.status;
}

// ---------------------------------------------------------------------------
// List the current student's own submitted attempts — powers "My Results".
// Only returns terminal statuses; hides in-progress / not-started attempts.
// ---------------------------------------------------------------------------

export async function listMyAttempts(studentId: string) {
  const prisma = getPrisma();
  const attempts = await prisma.examAttempt.findMany({
    where: {
      studentId,
      status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'] },
    },
    orderBy: { submittedAt: 'desc' },
    include: {
      exam: { select: { id: true, title: true, totalMarks: true, resultsReleased: true } },
      result: { select: { score: true, maxScore: true } },
    },
  });

  return attempts.map((a) => ({
    attemptId: a.id,
    examId: a.examId,
    examTitle: a.exam.title,
    status: a.status,
    submittedAt: (a.submittedAt ?? a.updatedAt).toISOString(),
    resultsReleased: a.exam.resultsReleased,
    score: a.result?.score ?? a.scoredMarks ?? null,
    maxScore: a.result?.maxScore ?? a.exam.totalMarks,
  }));
}
