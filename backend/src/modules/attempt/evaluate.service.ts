import { type Prisma } from '@prisma/client';

import { logger } from '@/common/logger.js';
import { getPrisma } from '@/db/prisma.js';

// ---------------------------------------------------------------------------
// Auto-grading — objective types get graded here; subjective (SHORT/LONG) are
// left with `scoredMarks = null` and surface via `hasPendingReview = true`.
// ---------------------------------------------------------------------------

const OBJECTIVE_TYPES = new Set(['MCQ', 'MSQ', 'TRUE_FALSE', 'FILL_BLANK', 'NUMERICAL']);

export async function evaluateAttempt(attemptId: string): Promise<void> {
  const prisma = getPrisma();
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId },
    include: {
      exam: { include: { questions: { include: { question: true } } } },
      answers: true,
    },
  });
  if (!attempt) throw new Error(`Attempt ${attemptId} not found`);
  if (attempt.status === 'EVALUATED') {
    logger.info({ attemptId }, 'evaluate: already evaluated, skipping');
    return;
  }

  const answersByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));

  let autoScored = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let hasPendingReview = false;

  for (const eq of attempt.exam.questions) {
    const q = eq.question;
    const answer = answersByQuestion.get(eq.questionId);
    const maxMarks = eq.marksOverride ?? q.marks;

    if (!answer || answer.answer === null || answer.answer === undefined) {
      unansweredCount++;
      continue;
    }

    if (!OBJECTIVE_TYPES.has(q.type)) {
      hasPendingReview = true;
      continue;
    }

    const scored = gradeObjective(
      q.type,
      q.correctAnswer,
      answer.answer,
      q.content,
      maxMarks,
      attempt.exam.negativeMarking,
    );
    autoScored += scored;
    if (scored > 0) correctCount++;
    else if (scored < 0 || scored === 0) wrongCount++;

    await prisma.attemptAnswer.update({
      where: { id: answer.id },
      data: {
        scoredMarks: scored,
        isAutoGraded: true,
        gradedAt: new Date(),
      },
    });
  }

  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      status: hasPendingReview ? attempt.status : 'EVALUATED',
      autoScoredMarks: autoScored,
      hasPendingReview,
      evaluatedAt: hasPendingReview ? null : new Date(),
    },
  });

  // Only mint a Result row when nothing is pending review (subjective flow
  // finalises later via `grading.submit-grades`).
  if (!hasPendingReview) {
    await upsertResult(attemptId, autoScored, correctCount, wrongCount, unansweredCount);
    await maybeAutoReleaseResults(attempt.exam);
  }

  logger.info(
    { attemptId, autoScored, correctCount, wrongCount, unansweredCount, hasPendingReview },
    'evaluate: attempt scored',
  );
}

// Auto-release for pure-objective exams once the exam window has closed. Skip
// if any question needs manual grading (teacher will release via the grading
// UI). Skip if the window is still open, so students who finish early don't
// leak answers to peers still writing.
async function maybeAutoReleaseResults(exam: {
  id: string;
  endAt: Date | null;
  resultsReleased: boolean;
  questions: Array<{ question: { type: string } }>;
}): Promise<void> {
  if (exam.resultsReleased) return;
  const hasSubjective = exam.questions.some((eq) => !OBJECTIVE_TYPES.has(eq.question.type));
  if (hasSubjective) return;
  if (exam.endAt && exam.endAt.getTime() > Date.now()) return;
  await getPrisma().exam.update({
    where: { id: exam.id },
    data: { resultsReleased: true },
  });
  logger.info({ examId: exam.id }, 'evaluate: auto-released results for pure-objective exam');
}

// Called from the grading module once a teacher finalises subjective marks.
export async function finaliseGradedAttempt(attemptId: string): Promise<void> {
  const prisma = getPrisma();
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId },
    include: { answers: true, exam: { include: { questions: true } } },
  });
  if (!attempt) return;
  const stillPending = attempt.answers.some((a) => a.scoredMarks === null);
  if (stillPending) return;

  const total = attempt.answers.reduce((s, a) => s + (a.scoredMarks ?? 0), 0);
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  for (const eq of attempt.exam.questions) {
    const a = attempt.answers.find((x) => x.questionId === eq.questionId);
    if (!a || a.answer === null) {
      unansweredCount++;
      continue;
    }
    const max =
      eq.marksOverride ?? attempt.exam.questions.find((e) => e.id === eq.id)?.marksOverride ?? 0;
    if ((a.scoredMarks ?? 0) > 0) correctCount++;
    else wrongCount++;
    void max;
  }

  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      status: 'EVALUATED',
      hasPendingReview: false,
      evaluatedAt: new Date(),
      scoredMarks: total,
    },
  });
  await upsertResult(attemptId, total, correctCount, wrongCount, unansweredCount);
}

async function upsertResult(
  attemptId: string,
  score: number,
  correctCount: number,
  wrongCount: number,
  unansweredCount: number,
): Promise<void> {
  const prisma = getPrisma();
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId },
    include: { exam: true },
  });
  if (!attempt) return;

  const maxScore = attempt.exam.totalMarks;
  const attempted = correctCount + wrongCount;
  const accuracy = attempted > 0 ? correctCount / attempted : 0;
  const timeSpentMs =
    attempt.startedAt && attempt.submittedAt
      ? attempt.submittedAt.getTime() - attempt.startedAt.getTime()
      : 0;

  await prisma.result.upsert({
    where: { attemptId },
    create: {
      tenantId: attempt.tenantId,
      attemptId,
      examId: attempt.examId,
      studentId: attempt.studentId,
      score,
      maxScore,
      accuracy,
      timeSpentMs,
      correctCount,
      wrongCount,
      unansweredCount,
    },
    update: {
      score,
      accuracy,
      correctCount,
      wrongCount,
      unansweredCount,
      timeSpentMs,
    },
  });
  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: { scoredMarks: score },
  });
}

// ---------------------------------------------------------------------------
// Objective graders
// ---------------------------------------------------------------------------

function gradeObjective(
  type: string,
  correctAnswer: Prisma.JsonValue | null,
  studentAnswer: Prisma.JsonValue,
  content: Prisma.JsonValue,
  maxMarks: number,
  negativeMarkingPct: number,
): number {
  const wrongPenalty = -maxMarks * (negativeMarkingPct / 100);

  switch (type) {
    case 'MCQ': {
      const isCorrect = studentAnswer === correctAnswer;
      return isCorrect ? maxMarks : wrongPenalty;
    }
    case 'MSQ': {
      const correct = new Set(Array.isArray(correctAnswer) ? (correctAnswer as string[]) : []);
      const chosen = new Set(Array.isArray(studentAnswer) ? (studentAnswer as string[]) : []);
      const sameSize = correct.size === chosen.size;
      const allMatch = sameSize && [...correct].every((c) => chosen.has(c));
      return allMatch ? maxMarks : wrongPenalty;
    }
    case 'TRUE_FALSE': {
      return studentAnswer === correctAnswer ? maxMarks : wrongPenalty;
    }
    case 'FILL_BLANK': {
      const correct = Array.isArray(correctAnswer) ? (correctAnswer as string[]) : [];
      const given = Array.isArray(studentAnswer) ? (studentAnswer as string[]) : [];
      if (correct.length === 0) return 0;
      let matched = 0;
      for (let i = 0; i < correct.length; i++) {
        const a = (given[i] ?? '').toString().trim().toLowerCase();
        const b = (correct[i] ?? '').toString().trim().toLowerCase();
        if (a && a === b) matched++;
      }
      // Partial credit — pro-rata across blanks.
      const ratio = matched / correct.length;
      if (ratio === 0) return wrongPenalty;
      return maxMarks * ratio;
    }
    case 'NUMERICAL': {
      const c = (content ?? {}) as Record<string, unknown>;
      const tolerance = typeof c.tolerance === 'number' ? c.tolerance : 0;
      const target = typeof correctAnswer === 'number' ? correctAnswer : Number(correctAnswer);
      const got = typeof studentAnswer === 'number' ? studentAnswer : Number(studentAnswer);
      if (!Number.isFinite(got) || !Number.isFinite(target)) return wrongPenalty;
      return Math.abs(got - target) <= tolerance ? maxMarks : wrongPenalty;
    }
    default:
      return 0;
  }
}
