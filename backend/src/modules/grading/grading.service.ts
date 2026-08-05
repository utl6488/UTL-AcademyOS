import type { GradeInput } from './grading.schemas.js';

import { AppError } from '@/common/errors/index.js';
import { getPrisma } from '@/db/prisma.js';
import { finaliseGradedAttempt } from '@/modules/attempt/evaluate.service.js';

// ---------------------------------------------------------------------------
// Queue view — one row per exam that has subjective attempts still awaiting
// review. Aggregates pending vs graded counts.
// ---------------------------------------------------------------------------

export async function listGradingQueue() {
  const prisma = getPrisma();
  const attempts = await prisma.examAttempt.findMany({
    where: { status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] }, hasPendingReview: true },
    include: { exam: { select: { id: true, title: true, resultsReleased: true } } },
  });

  const byExam = new Map<
    string,
    { title: string; released: boolean; pending: number; total: number; graded: number }
  >();
  for (const a of attempts) {
    const entry = byExam.get(a.examId) ?? {
      title: a.exam.title,
      released: a.exam.resultsReleased,
      pending: 0,
      total: 0,
      graded: 0,
    };
    entry.pending += 1;
    entry.total += 1;
    byExam.set(a.examId, entry);
  }

  // Also count EVALUATED (fully graded) attempts for the same exams.
  const evaluatedCounts = await prisma.examAttempt.groupBy({
    by: ['examId'],
    where: { status: 'EVALUATED', examId: { in: Array.from(byExam.keys()) } },
    _count: { _all: true },
  });
  for (const row of evaluatedCounts) {
    const entry = byExam.get(row.examId);
    if (entry) {
      entry.graded += row._count._all;
      entry.total += row._count._all;
    }
  }

  return Array.from(byExam.entries()).map(([examId, v]) => ({
    examId,
    examTitle: v.title,
    pendingCount: v.pending,
    totalCount: v.total,
    gradedCount: v.graded,
    released: v.released,
    dueDate: null as string | null,
  }));
}

export async function listGradingAttemptsForExam(examId: string) {
  const attempts = await getPrisma().examAttempt.findMany({
    where: { examId, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'] } },
    include: { student: { select: { name: true } } },
    orderBy: { submittedAt: 'asc' },
  });
  return attempts.map((a) => ({
    attemptId: a.id,
    studentName: a.student.name,
    isGraded: !a.hasPendingReview,
  }));
}

export async function getGradingAttempt(attemptId: string) {
  const prisma = getPrisma();
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId },
    include: {
      student: { select: { id: true, name: true, avatar: true } },
      exam: { include: { questions: { include: { question: true } } } },
      answers: true,
    },
  });
  if (!attempt) throw AppError.notFound('Attempt not found');

  const answersByQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const questions = attempt.exam.questions.map((eq) => {
    const q = eq.question;
    const ans = answersByQ.get(eq.questionId);
    const content = (q.content ?? {}) as Record<string, unknown>;
    return {
      questionId: eq.questionId,
      questionText: q.text,
      questionType: q.type,
      maxMarks: eq.marksOverride ?? q.marks,
      studentAnswer: ans?.answer ?? null,
      modelAnswer:
        typeof content.modelAnswer === 'string' ? content.modelAnswer : (q.correctAnswer ?? null),
      rubric: typeof content.rubric === 'string' ? content.rubric : null,
      scoredMarks: ans?.scoredMarks ?? null,
      feedback: ans?.feedback ?? null,
      isAutoGraded: ans?.isAutoGraded ?? false,
    };
  });

  const totalMarks = attempt.exam.totalMarks;
  const scoredMarks = attempt.answers.reduce((s, a) => s + (a.scoredMarks ?? 0), 0);

  return {
    attemptId: attempt.id,
    studentId: attempt.studentId,
    studentName: attempt.student.name,
    studentAvatar: attempt.student.avatar,
    submittedAt: attempt.submittedAt?.toISOString() ?? '',
    totalMarks,
    scoredMarks: attempt.answers.every((a) => a.scoredMarks !== null) ? scoredMarks : null,
    isGraded: !attempt.hasPendingReview,
    questions,
  };
}

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

export async function submitGrades(attemptId: string, actorId: string, grades: GradeInput[]) {
  const prisma = getPrisma();
  const attempt = await prisma.examAttempt.findFirst({ where: { id: attemptId } });
  if (!attempt) throw AppError.notFound('Attempt not found');
  if (attempt.status !== 'SUBMITTED' && attempt.status !== 'AUTO_SUBMITTED') {
    throw AppError.badRequest('Attempt is not in a gradeable state');
  }

  for (const g of grades) {
    const ans = await prisma.attemptAnswer.findFirst({
      where: { attemptId, questionId: g.questionId },
      select: { id: true },
    });
    if (!ans) continue;
    await prisma.attemptAnswer.update({
      where: { id: ans.id },
      data: {
        scoredMarks: g.marks,
        feedback: g.feedback ?? null,
        isAutoGraded: false,
        gradedById: actorId,
        gradedAt: new Date(),
      },
    });
  }

  await finaliseGradedAttempt(attemptId);
  return { ok: true };
}

export async function setResultsReleased(examId: string, released: boolean) {
  const exam = await getPrisma().exam.findFirst({ where: { id: examId }, select: { id: true } });
  if (!exam) throw AppError.notFound('Exam not found');
  await getPrisma().exam.update({ where: { id: examId }, data: { resultsReleased: released } });
  return { ok: true, released };
}
