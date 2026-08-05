import type { Prisma } from '@prisma/client';

import type { LeaderboardQuery } from './result.schemas.js';

import { AppError } from '@/common/errors/index.js';
import { getPrisma } from '@/db/prisma.js';

const WEAK_TOPIC_THRESHOLD = 0.6; // <60% accuracy → flag as weak
const PASSING_DEFAULT_PCT = 40; // fallback if tenant.passingPercentage missing

// ---------------------------------------------------------------------------
// Student result — full breakdown for the post-submit review page
// ---------------------------------------------------------------------------

export async function getStudentResult(actorId: string, actorRole: string, attemptId: string) {
  const prisma = getPrisma();
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId },
    include: {
      student: { select: { id: true, name: true } },
      exam: {
        include: {
          sections: { orderBy: { order: 'asc' } },
          questions: { include: { question: true } },
        },
      },
      answers: true,
      result: true,
    },
  });
  if (!attempt) throw AppError.notFound('Attempt not found');

  // Student can only see their own; also gated by exam.resultsReleased.
  if (actorRole === 'STUDENT') {
    if (attempt.studentId !== actorId) throw AppError.forbidden();
    if (!attempt.exam.resultsReleased) throw AppError.forbidden('Results not yet released');
  }

  const submittedAt = attempt.submittedAt ?? attempt.updatedAt;
  const startedAt = attempt.startedAt ?? attempt.createdAt;
  const timeTakenMinutes = Math.max(
    0,
    Math.round((submittedAt.getTime() - startedAt.getTime()) / 60000),
  );

  // Per-section scoring — sum marks by sectionId.
  const answersByQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const sectionAggregates = new Map<string, { title: string; score: number; totalMarks: number }>();

  for (const eq of attempt.exam.questions) {
    const sec = attempt.exam.sections.find((s) => s.id === eq.sectionId);
    const bucketKey = sec?.id ?? '__main';
    const bucketTitle = sec?.title ?? 'Main';
    const cur = sectionAggregates.get(bucketKey) ?? { title: bucketTitle, score: 0, totalMarks: 0 };
    const max = eq.marksOverride ?? eq.question.marks;
    const scored = answersByQ.get(eq.questionId)?.scoredMarks ?? 0;
    cur.score += scored;
    cur.totalMarks += max;
    sectionAggregates.set(bucketKey, cur);
  }

  // Per-topic accuracy: correct-count / total-count per topicId.
  const topicAgg = new Map<string, { topic: string; correct: number; total: number }>();
  for (const eq of attempt.exam.questions) {
    const q = eq.question;
    if (!q.topicId) continue;
    const bucket = topicAgg.get(q.topicId) ?? { topic: '', correct: 0, total: 0 };
    bucket.total += 1;
    const ans = answersByQ.get(eq.questionId);
    if ((ans?.scoredMarks ?? 0) > 0) bucket.correct += 1;
    topicAgg.set(q.topicId, bucket);
  }
  const topicIds = Array.from(topicAgg.keys());
  if (topicIds.length) {
    const topics = await prisma.topic.findMany({
      where: { id: { in: topicIds } },
      select: { id: true, name: true },
    });
    for (const t of topics) {
      const b = topicAgg.get(t.id);
      if (b) b.topic = t.name;
    }
  }

  // Rank + percentile via a single ordered pull. Cheap enough for MVP; if this
  // hits perf issues later we materialize via a scheduled recompute (Phase 12).
  const peerResults = await prisma.result.findMany({
    where: { examId: attempt.examId },
    orderBy: [{ score: 'desc' }, { timeSpentMs: 'asc' }],
    select: { attemptId: true, score: true },
  });
  const totalStudents = peerResults.length;
  const myIdx = peerResults.findIndex((r) => r.attemptId === attemptId);
  const rank = myIdx >= 0 ? myIdx + 1 : totalStudents; // fallback for un-evaluated
  const percentile =
    totalStudents > 0 ? Math.round(((totalStudents - rank) / totalStudents) * 1000) / 10 : 0;

  const totalMarks = attempt.exam.totalMarks;
  const score = attempt.result?.score ?? attempt.scoredMarks ?? 0;

  const questions = attempt.exam.questions.map((eq, idx) => {
    const q = eq.question;
    const ans = answersByQ.get(eq.questionId);
    const maxMarks = eq.marksOverride ?? q.marks;
    const scored = ans?.scoredMarks ?? 0;
    return {
      questionId: eq.questionId,
      questionText: q.text,
      questionType: q.type,
      studentAnswer: ans?.answer ?? null,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      marks: maxMarks,
      scoredMarks: scored,
      isCorrect: scored >= maxMarks - 0.001,
      _idx: idx + 1,
    };
  });

  return {
    attemptId: attempt.id,
    examId: attempt.examId,
    examTitle: attempt.exam.title,
    studentId: attempt.student.id,
    studentName: attempt.student.name,
    score,
    totalMarks,
    percentage: totalMarks > 0 ? Math.round((score / totalMarks) * 1000) / 10 : 0,
    rank,
    totalStudents,
    percentile,
    submittedAt: submittedAt.toISOString(),
    timeTakenMinutes,
    sections: Array.from(sectionAggregates.values()).map((s) => ({
      title: s.title,
      score: s.score,
      totalMarks: s.totalMarks,
      percentage: s.totalMarks > 0 ? Math.round((s.score / s.totalMarks) * 1000) / 10 : 0,
    })),
    topicAccuracy: Array.from(topicAgg.values()).map((t) => ({
      topic: t.topic,
      correct: t.correct,
      total: t.total,
      accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 1000) / 10 : 0,
    })),
    timePerQuestion: attempt.answers.map((a, i) => ({
      questionNumber: i + 1,
      seconds: Math.round(a.timeSpentMs / 1000),
    })),
    questions: questions.map(({ _idx, ...rest }) => rest),
  };
}

// ---------------------------------------------------------------------------
// Leaderboard — paginated, tie-break on time.
// ---------------------------------------------------------------------------

export async function getLeaderboard(actorId: string, examId: string, query: LeaderboardQuery) {
  const prisma = getPrisma();
  const exam = await prisma.exam.findFirst({
    where: { id: examId },
    select: { id: true, totalMarks: true, resultsReleased: true },
  });
  if (!exam) throw AppError.notFound('Exam not found');

  const where: Prisma.ResultWhereInput = { examId };
  // scope=class/batch — restrict peers to the actor's class/batch cohort.
  if (query.scope !== 'exam') {
    const me = await prisma.user.findFirst({
      where: { id: actorId },
      select: { classId: true, batchMemberships: { select: { batchId: true } } },
    });
    if (query.scope === 'class' && me?.classId) {
      where.student = { classId: me.classId };
    } else if (query.scope === 'batch' && me?.batchMemberships?.length) {
      where.student = {
        batchMemberships: { some: { batchId: { in: me.batchMemberships.map((m) => m.batchId) } } },
      };
    }
  }

  const total = await prisma.result.count({ where });
  const rows = await prisma.result.findMany({
    where,
    orderBy: [{ score: 'desc' }, { timeSpentMs: 'asc' }],
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
    include: { student: { select: { id: true, name: true, avatar: true } } },
  });

  const startRank = (query.page - 1) * query.pageSize + 1;
  return {
    data: rows.map((r, i) => ({
      rank: startRank + i,
      studentId: r.student.id,
      studentName: r.student.name,
      studentAvatar: r.student.avatar,
      score: r.score,
      totalMarks: r.maxScore,
      percentage: r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 1000) / 10 : 0,
      timeTakenMinutes: Math.round(r.timeSpentMs / 60000),
      isCurrentUser: r.studentId === actorId,
    })),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

// ---------------------------------------------------------------------------
// Class report — teacher view of the whole cohort's performance
// ---------------------------------------------------------------------------

export async function getClassReport(examId: string) {
  const prisma = getPrisma();
  const exam = await prisma.exam.findFirst({
    where: { id: examId },
    include: {
      questions: {
        include: { question: { select: { topicId: true, topic: { select: { name: true } } } } },
      },
      assignments: true,
      results: {
        include: { student: { select: { name: true } } },
        orderBy: [{ score: 'desc' }, { timeSpentMs: 'asc' }],
      },
      attempts: { select: { status: true } },
      tenant: { select: { passingPercentage: true } },
    },
  });
  if (!exam) throw AppError.notFound('Exam not found');

  // Roster size — expand class/batch/student assignments.
  const classIds = exam.assignments.map((a) => a.classId).filter((v): v is string => !!v);
  const batchIds = exam.assignments.map((a) => a.batchId).filter((v): v is string => !!v);
  const studentIds = new Set(
    exam.assignments.map((a) => a.studentId).filter((v): v is string => !!v),
  );
  if (classIds.length) {
    const s = await prisma.user.findMany({
      where: { role: 'STUDENT', classId: { in: classIds } },
      select: { id: true },
    });
    for (const u of s) studentIds.add(u.id);
  }
  if (batchIds.length) {
    const m = await prisma.batchMember.findMany({
      where: { batchId: { in: batchIds } },
      select: { userId: true },
    });
    for (const u of m) studentIds.add(u.userId);
  }
  const totalStudents = studentIds.size;

  const attemptedStudents = exam.attempts.filter((a) => a.status !== 'NOT_STARTED').length;
  const completed = exam.attempts.filter((a) =>
    ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'].includes(a.status),
  ).length;

  const scores = exam.results.map((r) => r.score);
  const highestScore = scores.length ? Math.max(...scores) : 0;
  const lowestScore = scores.length ? Math.min(...scores) : 0;
  const averageScore = scores.length
    ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100
    : 0;

  const passingPct = exam.tenant?.passingPercentage ?? PASSING_DEFAULT_PCT;
  const passingMarks = (passingPct / 100) * exam.totalMarks;
  const passed = exam.results.filter((r) => r.score >= passingMarks).length;
  const passRate = exam.results.length ? Math.round((passed / exam.results.length) * 1000) / 10 : 0;

  const scoreDistribution = distribution(scores, exam.totalMarks);

  const toppers = exam.results.slice(0, 5).map((r, i) => ({
    rank: i + 1,
    studentName: r.student.name,
    score: r.score,
    percentage: exam.totalMarks > 0 ? Math.round((r.score / exam.totalMarks) * 1000) / 10 : 0,
  }));

  // Weak topics — aggregate per-topic accuracy across every graded answer.
  const answers = await prisma.attemptAnswer.findMany({
    where: {
      attempt: { examId },
      scoredMarks: { not: null },
    },
    include: {
      question: { select: { topicId: true, topic: { select: { name: true } }, marks: true } },
    },
  });
  const topicAgg = new Map<
    string,
    { topic: string; correct: number; total: number; students: Set<string> }
  >();
  for (const a of answers) {
    if (!a.question.topicId) continue;
    const bucket = topicAgg.get(a.question.topicId) ?? {
      topic: a.question.topic?.name ?? '',
      correct: 0,
      total: 0,
      students: new Set<string>(),
    };
    bucket.total += 1;
    if ((a.scoredMarks ?? 0) > 0) bucket.correct += 1;
    bucket.students.add(a.attemptId);
    topicAgg.set(a.question.topicId, bucket);
  }
  const weakTopics = Array.from(topicAgg.values())
    .map((v) => ({
      topic: v.topic,
      averageAccuracy: v.total > 0 ? Math.round((v.correct / v.total) * 1000) / 10 : 0,
      studentCount: v.students.size,
    }))
    .filter((t) => t.averageAccuracy < WEAK_TOPIC_THRESHOLD * 100)
    .sort((a, b) => a.averageAccuracy - b.averageAccuracy)
    .slice(0, 10);

  return {
    examId: exam.id,
    examTitle: exam.title,
    totalStudents,
    attemptedStudents,
    averageScore,
    highestScore,
    lowestScore,
    passRate,
    scoreDistribution,
    toppers,
    weakTopics,
    completionFunnel: {
      assigned: totalStudents,
      started: attemptedStudents,
      completed,
      passed,
    },
  };
}

// Bucket scores into 5 equal ranges of exam totalMarks (0-20%, 20-40%, ...).
function distribution(
  scores: number[],
  totalMarks: number,
): Array<{ range: string; count: number }> {
  if (totalMarks <= 0) return [];
  const buckets = [
    { range: '0-20%', min: 0, max: 0.2 * totalMarks, count: 0 },
    { range: '20-40%', min: 0.2 * totalMarks, max: 0.4 * totalMarks, count: 0 },
    { range: '40-60%', min: 0.4 * totalMarks, max: 0.6 * totalMarks, count: 0 },
    { range: '60-80%', min: 0.6 * totalMarks, max: 0.8 * totalMarks, count: 0 },
    { range: '80-100%', min: 0.8 * totalMarks, max: totalMarks + 0.001, count: 0 },
  ];
  for (const s of scores) {
    for (const b of buckets) {
      if (s >= b.min && s < b.max) {
        b.count += 1;
        break;
      }
    }
  }
  return buckets.map((b) => ({ range: b.range, count: b.count }));
}
