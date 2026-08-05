import { AppError } from '@/common/errors/index.js';
import { getPrisma } from '@/db/prisma.js';

const ACTIVE_WINDOW_DAYS = 30;
const AT_RISK_THRESHOLD = 0.4; // avg accuracy < 40% over last N attempts
const WEAK_TOPIC_THRESHOLD = 0.6;

/**
 * Institute-wide KPIs for the dashboard tile row.
 * Snapshot as of now — no time-series (that lands with Phase B12 rollups).
 */
export async function getInstituteDashboard() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86400_000);

  const [examsConducted, avgAccuracy, activeStudentIds, recentExams] = await Promise.all([
    prisma.exam.count({ where: { status: { in: ['COMPLETED', 'LIVE'] } } }),
    prisma.result.aggregate({ _avg: { accuracy: true } }),
    prisma.examAttempt.findMany({
      where: { createdAt: { gte: since }, status: { not: 'NOT_STARTED' } },
      select: { studentId: true },
      distinct: ['studentId'],
    }),
    prisma.exam.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      include: {
        results: { select: { score: true } },
        _count: { select: { attempts: true } },
      },
    }),
  ]);

  // At-risk: students whose average accuracy across last 3 evaluated attempts is below threshold.
  const recentByStudent = await prisma.result.findMany({
    where: {},
    orderBy: [{ studentId: 'asc' }, { createdAt: 'desc' }],
    select: { studentId: true, accuracy: true },
  });
  const byStudent = new Map<string, number[]>();
  for (const r of recentByStudent) {
    const arr = byStudent.get(r.studentId) ?? [];
    if (arr.length < 3) arr.push(r.accuracy);
    byStudent.set(r.studentId, arr);
  }
  let atRiskCount = 0;
  for (const acc of byStudent.values()) {
    if (acc.length === 0) continue;
    const avg = acc.reduce((s, v) => s + v, 0) / acc.length;
    if (avg < AT_RISK_THRESHOLD) atRiskCount += 1;
  }

  const averageScore = Math.round((avgAccuracy._avg.accuracy ?? 0) * 1000) / 10; // percentage

  return {
    examsConduted: examsConducted, // frontend spelling — keep as-is
    averageScore,
    activeStudents: activeStudentIds.length,
    atRiskCount,
    recentExams: recentExams.map((e) => ({
      id: e.id,
      title: e.title,
      date: (e.publishedAt ?? e.createdAt).toISOString(),
      avgScore:
        e.results.length > 0
          ? Math.round((e.results.reduce((s, r) => s + r.score, 0) / e.results.length) * 100) / 100
          : 0,
      students: e._count.attempts,
    })),
  };
}

/**
 * Batch performance over time — exam-by-exam averages plus weak-topic drift.
 * Pure aggregator (no LLM). Feeds the institute analytics dashboard.
 */
export async function getBatchTrends(
  batchId: string,
  opts: { limit?: number } = {},
): Promise<{
  batchId: string;
  batchName: string;
  memberCount: number;
  exams: Array<{
    examId: string;
    examTitle: string;
    date: string;
    averageScore: number;
    averageAccuracy: number;
    participation: number;
    passed: number;
    attempted: number;
  }>;
  averageAccuracyTrend: 'improving' | 'declining' | 'stable';
  weakTopics: Array<{ topic: string; averageAccuracy: number; questionCount: number }>;
}> {
  const prisma = getPrisma();
  const limit = Math.max(1, Math.min(50, opts.limit ?? 10));

  const batch = await prisma.batch.findFirst({
    where: { id: batchId },
    include: {
      members: { select: { userId: true } },
      tenant: { select: { passingPercentage: true } },
    },
  });
  if (!batch) throw AppError.notFound('Batch not found');

  const memberIds = batch.members.map((m) => m.userId);
  if (!memberIds.length) {
    return {
      batchId: batch.id,
      batchName: batch.name,
      memberCount: 0,
      exams: [],
      averageAccuracyTrend: 'stable',
      weakTopics: [],
    };
  }

  // Pull one Result per (student, exam), newest first — then group per exam.
  const results = await prisma.result.findMany({
    where: { studentId: { in: memberIds } },
    orderBy: { createdAt: 'desc' },
    include: { exam: { select: { id: true, title: true, totalMarks: true, publishedAt: true } } },
  });

  const byExam = new Map<
    string,
    {
      examId: string;
      examTitle: string;
      date: Date;
      totalMarks: number;
      scores: number[];
      accuracies: number[];
      passed: number;
    }
  >();
  const passingPct = (batch.tenant?.passingPercentage ?? 40) / 100;
  for (const r of results) {
    const bucket = byExam.get(r.examId) ?? {
      examId: r.examId,
      examTitle: r.exam.title,
      date: r.exam.publishedAt ?? r.createdAt,
      totalMarks: r.exam.totalMarks,
      scores: [],
      accuracies: [],
      passed: 0,
    };
    bucket.scores.push(r.score);
    bucket.accuracies.push(r.accuracy);
    if (r.score >= passingPct * r.exam.totalMarks) bucket.passed += 1;
    byExam.set(r.examId, bucket);
  }

  const exams = Array.from(byExam.values())
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, limit)
    .map((e) => {
      const avgScore =
        e.scores.length > 0 ? e.scores.reduce((s, v) => s + v, 0) / e.scores.length : 0;
      const avgAcc =
        e.accuracies.length > 0 ? e.accuracies.reduce((s, v) => s + v, 0) / e.accuracies.length : 0;
      return {
        examId: e.examId,
        examTitle: e.examTitle,
        date: e.date.toISOString(),
        averageScore: Math.round(avgScore * 100) / 100,
        averageAccuracy: Math.round(avgAcc * 1000) / 10,
        participation: e.scores.length,
        passed: e.passed,
        attempted: e.scores.length,
      };
    })
    .reverse(); // chronological ascending for charts

  // Trend: compare first half vs second half of the series.
  const accSeries = exams.map((e) => e.averageAccuracy / 100);
  const trend =
    accSeries.length < 2
      ? 'stable'
      : (() => {
          const half = Math.floor(accSeries.length / 2);
          const a = accSeries.slice(0, Math.max(1, half));
          const b = accSeries.slice(half);
          const avgA = a.reduce((s, v) => s + v, 0) / a.length;
          const avgB = b.reduce((s, v) => s + v, 0) / b.length;
          const delta = avgB - avgA;
          if (delta > 0.05) return 'improving' as const;
          if (delta < -0.05) return 'declining' as const;
          return 'stable' as const;
        })();

  // Weak-topic aggregate across all cohort answers.
  const answers = await prisma.attemptAnswer.findMany({
    where: {
      attempt: { studentId: { in: memberIds } },
      scoredMarks: { not: null },
    },
    include: { question: { select: { topicId: true, topic: { select: { name: true } } } } },
  });
  const topicAgg = new Map<string, { topic: string; correct: number; total: number }>();
  for (const a of answers) {
    if (!a.question.topicId) continue;
    const b = topicAgg.get(a.question.topicId) ?? {
      topic: a.question.topic?.name ?? '',
      correct: 0,
      total: 0,
    };
    b.total += 1;
    if ((a.scoredMarks ?? 0) > 0) b.correct += 1;
    topicAgg.set(a.question.topicId, b);
  }
  const weakTopics = Array.from(topicAgg.values())
    .map((v) => ({
      topic: v.topic,
      averageAccuracy: v.total > 0 ? Math.round((v.correct / v.total) * 1000) / 10 : 0,
      questionCount: v.total,
    }))
    .filter((t) => t.averageAccuracy < WEAK_TOPIC_THRESHOLD * 100)
    .sort((a, b) => a.averageAccuracy - b.averageAccuracy)
    .slice(0, 10);

  return {
    batchId: batch.id,
    batchName: batch.name,
    memberCount: memberIds.length,
    exams,
    averageAccuracyTrend: trend,
    weakTopics,
  };
}
