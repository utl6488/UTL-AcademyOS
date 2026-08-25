import type { AiFeedbackInput, GenerateExamInput, GenerateQuestionsInput } from './ai.schemas.js';
import { getPrompt } from './prompts/registry.js';
import { pickProvider, type ChatOptions } from './providers/index.js';
import { recordUsage } from './usage.service.js';

import { AppError } from '@/common/errors/index.js';
import { logger } from '@/common/logger.js';
import { getPrisma } from '@/db/prisma.js';
import { getClassReport } from '@/modules/result/result.service.js';

// ---------------------------------------------------------------------------
// Helper: run a prompt through the picked provider, log usage, return text.
// ---------------------------------------------------------------------------

async function runPrompt(tenantId: string, feature: string, opts: Omit<ChatOptions, 'feature'>) {
  const provider = pickProvider();
  const started = Date.now();
  try {
    const result = await provider.chat({ ...opts, feature });
    const outputId = await recordUsage(tenantId, feature, result);
    return { outputId, text: result.text, provider: result.provider };
  } catch (err) {
    logger.error({ err, feature, ms: Date.now() - started }, 'ai: provider call failed');
    throw AppError.internal('AI provider failed');
  }
}

function safeJson<T>(text: string, fallback: T): T {
  try {
    // Handle providers that occasionally wrap JSON in a code fence.
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/```$/i, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Student features
// ---------------------------------------------------------------------------

/**
 * Weak topics — pure aggregator over the student's Result history. No LLM.
 * Trend is computed by comparing accuracy in the last exam to the average of
 * the prior two.
 */
export async function getWeakTopics(studentId: string) {
  const prisma = getPrisma();
  const results = await prisma.result.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { attemptId: true, createdAt: true },
  });
  if (!results.length) return [];

  const attempts = await prisma.examAttempt.findMany({
    where: { id: { in: results.map((r) => r.attemptId) } },
    include: {
      answers: {
        include: {
          question: {
            select: { topicId: true, topic: { select: { name: true } } },
          },
        },
      },
    },
  });

  const bucket = new Map<
    string,
    { topic: string; correct: number; total: number; history: Array<{ at: Date; acc: number }> }
  >();

  for (const a of attempts) {
    const perTopic = new Map<string, { correct: number; total: number; name: string }>();
    for (const ans of a.answers) {
      if (!ans.question.topicId) continue;
      const b = perTopic.get(ans.question.topicId) ?? {
        correct: 0,
        total: 0,
        name: ans.question.topic?.name ?? '',
      };
      b.total += 1;
      if ((ans.scoredMarks ?? 0) > 0) b.correct += 1;
      perTopic.set(ans.question.topicId, b);
    }
    for (const [topicId, v] of perTopic) {
      const acc = v.total > 0 ? v.correct / v.total : 0;
      const cur = bucket.get(topicId) ?? { topic: v.name, correct: 0, total: 0, history: [] };
      cur.correct += v.correct;
      cur.total += v.total;
      cur.history.push({ at: a.createdAt, acc });
      bucket.set(topicId, cur);
    }
  }

  return Array.from(bucket.values())
    .map((v) => {
      v.history.sort((a, b) => a.at.getTime() - b.at.getTime());
      const trend = computeTrend(v.history.map((h) => h.acc));
      return {
        topic: v.topic,
        accuracy: Math.round((v.correct / Math.max(1, v.total)) * 1000) / 10,
        questionsAttempted: v.total,
        trend,
      };
    })
    .filter((v) => v.accuracy < 70) // weak = <70% accuracy
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 10);
}

function computeTrend(series: number[]): 'improving' | 'declining' | 'stable' {
  if (series.length < 2) return 'stable';
  const first = series.slice(0, Math.max(1, Math.floor(series.length / 2)));
  const last = series.slice(Math.floor(series.length / 2));
  const avgA = first.reduce((s, v) => s + v, 0) / first.length;
  const avgB = last.reduce((s, v) => s + v, 0) / last.length;
  const delta = avgB - avgA;
  if (delta > 0.05) return 'improving';
  if (delta < -0.05) return 'declining';
  return 'stable';
}

/**
 * Predictions — heuristic on last-5 Result rows. `predictedScore` = weighted
 * moving average biased to recent; `confidence` grows with sample size.
 */
export async function getPredictions(studentId: string) {
  const results = await getPrisma().result.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { score: true, maxScore: true, accuracy: true },
  });
  if (!results.length) {
    return {
      predictedScore: 0,
      readinessPercent: 0,
      confidence: 0,
      factors: ['Not enough exam history yet — take a few practice exams to unlock predictions.'],
    };
  }

  // Weighted moving average — most recent counts 3×.
  const weights = [3, 2, 1.5, 1, 0.5].slice(0, results.length);
  const totalWeight = weights.reduce((s, v) => s + v, 0);
  const weightedAvgPct =
    results
      .map((r, i) => (r.maxScore > 0 ? (r.score / r.maxScore) * (weights[i] ?? 0) : 0))
      .reduce((s, v) => s + v, 0) / totalWeight;

  const readiness = Math.round(weightedAvgPct * 100);
  const predictedScore = Math.round(readiness);
  const confidence = Math.min(0.95, results.length / 5);

  const trend = computeTrend(
    results
      .slice()
      .reverse()
      .map((r) => r.accuracy),
  );
  const factors: string[] = [
    `Based on your last ${results.length} exam${results.length > 1 ? 's' : ''}`,
    `Recent trend: ${trend}`,
  ];
  if (trend === 'improving') factors.push('You are on an upward trajectory — keep it up.');
  else if (trend === 'declining') factors.push('Recent scores dipped — revisit weak topics.');

  return {
    predictedScore,
    readinessPercent: readiness,
    confidence: Math.round(confidence * 100) / 100,
    factors,
  };
}

/** Latest cached study plan; null if none. */
export async function getStudyPlan(studentId: string) {
  const p = await getPrisma().studentStudyPlan.findFirst({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
  });
  if (!p) return null;
  return {
    id: p.id,
    week: p.week,
    topics: p.topics,
    tasks: p.tasks,
    createdAt: p.createdAt.toISOString(),
  };
}

/**
 * Generate + persist a study plan. Uses the LLM if configured; otherwise falls
 * back to a plan built from the student's weak topics + generic tasks.
 */
export async function generateStudyPlan(tenantId: string, studentId: string) {
  const weak = await getWeakTopics(studentId);
  const topicList = weak.slice(0, 5).map((t) => t.topic);

  const prompt = getPrompt('student.studyPlan');
  const { text, provider } = await runPrompt(tenantId, 'student.studyPlan', {
    jsonMode: true,
    messages: [
      { role: 'system', content: prompt.system },
      {
        role: 'user',
        content: `Weak topics (in order): ${topicList.join(', ') || 'none yet'}. Design a 1-week plan.`,
      },
    ],
  });

  const parsed = safeJson<{ week?: number; topics?: string[]; tasks?: string[] }>(text, {});
  const topics = Array.isArray(parsed.topics) && parsed.topics.length ? parsed.topics : topicList;
  const tasks =
    Array.isArray(parsed.tasks) && parsed.tasks.length
      ? parsed.tasks
      : buildHeuristicTasks(topicList);

  const week = typeof parsed.week === 'number' ? parsed.week : 1;
  const prisma = getPrisma();
  const created = await prisma.studentStudyPlan.create({
    data: { tenantId, studentId, week, topics, tasks },
  });
  logger.info({ studentId, provider, week, topicCount: topics.length }, 'ai: study plan generated');

  return {
    id: created.id,
    week,
    topics,
    tasks,
    createdAt: created.createdAt.toISOString(),
  };
}

function buildHeuristicTasks(topics: string[]): string[] {
  if (!topics.length) {
    return [
      'Take one practice exam to establish a baseline',
      'Review your last exam solutions',
      'Set a daily study block of 60 minutes',
    ];
  }
  const tasks: string[] = [];
  topics.slice(0, 3).forEach((t) => {
    tasks.push(`Review core concepts in ${t}`);
    tasks.push(`Solve 10 practice questions on ${t}`);
  });
  tasks.push('Take a 30-minute timed mixed-topic quiz on Sunday');
  return tasks;
}

// ---------------------------------------------------------------------------
// Teacher features
// ---------------------------------------------------------------------------

export async function generateQuestions(tenantId: string, input: GenerateQuestionsInput) {
  const prompt = getPrompt('teacher.generateQuestions');
  const { text, provider } = await runPrompt(tenantId, 'teacher.generateQuestions', {
    jsonMode: true,
    messages: [
      { role: 'system', content: prompt.system },
      {
        role: 'user',
        content: `Topic: ${input.topic}\nType: ${input.type}\nDifficulty: ${input.difficulty}\nCount: ${input.count}\n${
          input.subjectId ? `Subject ID: ${input.subjectId}` : ''
        }\nGenerate ${input.count} question(s) matching the exact JSON shape.`,
      },
    ],
    maxTokens: 2048,
  });

  const parsed = safeJson<unknown>(text, []);
  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { questions?: unknown[] })?.questions)
      ? (parsed as { questions: unknown[] }).questions
      : [];

  if (arr.length > 0 || provider !== 'heuristic') {
    return normalizeQuestions(arr, input);
  }

  // Heuristic fallback — deterministic placeholder set so the UI stays usable.
  return Array.from({ length: input.count }, (_, i) => heuristicQuestion(input, i + 1));
}

function normalizeQuestions(arr: unknown[], input: GenerateQuestionsInput) {
  return arr.slice(0, input.count).map((raw) => {
    const q = raw as Record<string, unknown>;
    return {
      type: (q.type as string) ?? input.type,
      subjectId: (q.subjectId as string) ?? input.subjectId ?? '',
      topicId: (q.topicId as string) ?? undefined,
      difficulty: (q.difficulty as 'easy' | 'medium' | 'hard') ?? input.difficulty,
      marks: typeof q.marks === 'number' ? q.marks : 1,
      tags: Array.isArray(q.tags) ? (q.tags as string[]) : [input.topic],
      text: (q.text as string) ?? `Question about ${input.topic}`,
      explanation: (q.explanation as string) ?? undefined,
      options: q.options as unknown,
      correctAnswer: q.correctAnswer as unknown,
      blanks: q.blanks as unknown,
      tolerance: q.tolerance as number | undefined,
      unit: q.unit as string | undefined,
      modelAnswer: q.modelAnswer as string | undefined,
      rubric: q.rubric as string | undefined,
      imageUrl: q.imageUrl as string | undefined,
    };
  });
}

function heuristicQuestion(input: GenerateQuestionsInput, n: number) {
  const base = {
    type: input.type,
    subjectId: input.subjectId ?? '',
    difficulty: input.difficulty,
    marks: 1,
    tags: [input.topic],
    text: `[Draft ${n}] Explain a key concept in ${input.topic}.`,
    explanation: `Placeholder — review + edit before publishing.`,
  };
  if (input.type === 'MCQ' || input.type === 'MSQ') {
    return {
      ...base,
      options: [
        { id: 'a', text: 'Option A', isCorrect: true },
        { id: 'b', text: 'Option B', isCorrect: input.type === 'MSQ' },
        { id: 'c', text: 'Option C', isCorrect: false },
        { id: 'd', text: 'Option D', isCorrect: false },
      ],
    };
  }
  if (input.type === 'TRUE_FALSE') return { ...base, correctAnswer: true };
  if (input.type === 'FILL_BLANK') return { ...base, blanks: ['answer'] };
  if (input.type === 'NUMERICAL') return { ...base, correctAnswer: 0, tolerance: 0 };
  return { ...base, modelAnswer: 'Sample model answer' };
}

/**
 * Compose a draft exam from the existing question bank matching the requested
 * difficulty distribution. Creates an Exam row in DRAFT status; returns its id.
 */
export async function generateExam(
  tenantId: string,
  actorId: string | undefined,
  input: GenerateExamInput,
) {
  const prisma = getPrisma();
  const [easy, medium, hard] = await Promise.all([
    prisma.question.findMany({
      where: { subjectId: input.subjectId, difficulty: 'EASY' },
      take: input.difficultyDistribution.easy,
    }),
    prisma.question.findMany({
      where: { subjectId: input.subjectId, difficulty: 'MEDIUM' },
      take: input.difficultyDistribution.medium,
    }),
    prisma.question.findMany({
      where: { subjectId: input.subjectId, difficulty: 'HARD' },
      take: input.difficultyDistribution.hard,
    }),
  ]);
  const picked = [...easy, ...medium, ...hard];
  if (!picked.length) {
    throw AppError.badRequest('No questions available in the bank for that subject');
  }

  const perQ = input.totalMarks / picked.length;
  const created = await prisma.exam.create({
    data: {
      tenantId,
      createdById: actorId,
      title: `AI Draft Exam (${new Date().toISOString().slice(0, 10)})`,
      durationMinutes: input.duration,
      totalMarks: input.totalMarks,
    },
  });
  await prisma.examQuestion.createMany({
    data: picked.map((q, i) => ({
      tenantId,
      examId: created.id,
      questionId: q.id,
      order: i,
      marksOverride: Math.round(perQ * 100) / 100,
    })),
  });

  logger.info({ examId: created.id, count: picked.length }, 'ai: exam draft generated');
  return { examId: created.id };
}

// ---------------------------------------------------------------------------
// Teacher: homework recommendation for a class or batch
// ---------------------------------------------------------------------------

export interface HomeworkRecommendation {
  cohortSize: number;
  topWeakTopics: Array<{ topic: string; affectedStudents: number; averageAccuracy: number }>;
  questions: Array<{
    id: string;
    text: string;
    difficulty: string;
    topic: string | null;
    marks: number;
    reason: string;
  }>;
}

export async function recommendHomework(
  tenantId: string,
  opts: { classId?: string; batchId?: string; subjectId?: string; count: number },
): Promise<HomeworkRecommendation> {
  if (!opts.classId && !opts.batchId) {
    throw AppError.badRequest('classId or batchId is required');
  }
  const prisma = getPrisma();

  const students = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      ...(opts.classId ? { classId: opts.classId } : {}),
      ...(opts.batchId ? { batchMemberships: { some: { batchId: opts.batchId } } } : {}),
    },
    select: { id: true },
  });
  if (!students.length) {
    return { cohortSize: 0, topWeakTopics: [], questions: [] };
  }

  // Aggregate weak topics across the cohort: rank by how many students struggle
  // with each topic, weighted by (100 - accuracy) so worse topics rise higher.
  const topicScores = new Map<
    string,
    { topic: string; students: Set<string>; weightedScore: number; accuracies: number[] }
  >();
  await Promise.all(
    students.map(async (s) => {
      const weak = await getWeakTopics(s.id);
      for (const w of weak) {
        const bucket = topicScores.get(w.topic) ?? {
          topic: w.topic,
          students: new Set<string>(),
          weightedScore: 0,
          accuracies: [],
        };
        bucket.students.add(s.id);
        bucket.weightedScore += 100 - w.accuracy;
        bucket.accuracies.push(w.accuracy);
        topicScores.set(w.topic, bucket);
      }
    }),
  );
  const topWeakTopics = Array.from(topicScores.values())
    .map((v) => ({
      topic: v.topic,
      affectedStudents: v.students.size,
      averageAccuracy:
        v.accuracies.length > 0
          ? Math.round((v.accuracies.reduce((a, b) => a + b, 0) / v.accuracies.length) * 10) / 10
          : 0,
      _weight: v.weightedScore,
    }))
    .sort((a, b) => b._weight - a._weight)
    .slice(0, 5);

  const topicNames = topWeakTopics.map((t) => t.topic).filter((n) => n.length > 0);
  const topicRows = topicNames.length
    ? await prisma.topic.findMany({
        where: { name: { in: topicNames } },
        select: { id: true, name: true },
      })
    : [];
  const topicIds = topicRows.map((t) => t.id);

  const questions = await prisma.question.findMany({
    where: {
      ...(topicIds.length ? { topicId: { in: topicIds } } : {}),
      ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
    },
    include: { topic: { select: { name: true } } },
    orderBy: [{ difficulty: 'asc' }, { createdAt: 'desc' }],
    take: opts.count,
  });

  // If nothing matched (no weak-topic questions in bank), broaden to subject.
  const finalQuestions = questions.length
    ? questions
    : await prisma.question.findMany({
        where: opts.subjectId ? { subjectId: opts.subjectId } : {},
        include: { topic: { select: { name: true } } },
        orderBy: [{ difficulty: 'asc' }],
        take: opts.count,
      });

  logger.info(
    { tenantId, cohort: students.length, questionCount: finalQuestions.length },
    'ai: homework recommended',
  );

  return {
    cohortSize: students.length,
    topWeakTopics: topWeakTopics.map(({ _weight, ...rest }) => rest),
    questions: finalQuestions.map((q) => {
      const topicName = q.topic?.name ?? null;
      const affected = topicName ? (topicScores.get(topicName)?.students.size ?? 0) : 0;
      const reason = topicName
        ? affected > 0
          ? `Targets ${topicName} — weak for ${affected} student${affected === 1 ? '' : 's'}.`
          : `Related to ${topicName}.`
        : 'Broad practice question.';
      return {
        id: q.id,
        text: q.text,
        difficulty: q.difficulty.toLowerCase(),
        topic: topicName,
        marks: q.marks,
        reason,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Teacher: class performance summary (natural-language narrative)
// ---------------------------------------------------------------------------

export interface ClassSummary {
  headline: string;
  highlights: string[];
  concerns: string[];
  recommendedActions: string[];
  metrics: {
    attemptedStudents: number;
    totalStudents: number;
    averageScore: number;
    passRate: number;
    weakTopics: Array<{ topic: string; averageAccuracy: number }>;
  };
}

/**
 * Compose a natural-language performance narrative over a completed exam. Runs
 * the existing class-report aggregator, feeds the numbers to the LLM, and falls
 * back to a deterministic template when no key is configured.
 */
export async function generateClassSummary(
  tenantId: string,
  examId: string,
): Promise<ClassSummary & { outputId?: string }> {
  const report = await getClassReport(examId);
  const metrics: ClassSummary['metrics'] = {
    attemptedStudents: report.attemptedStudents,
    totalStudents: report.totalStudents,
    averageScore: report.averageScore,
    passRate: report.passRate,
    weakTopics: report.weakTopics.slice(0, 5).map((t) => ({
      topic: t.topic,
      averageAccuracy: t.averageAccuracy,
    })),
  };

  const prompt = getPrompt('teacher.classSummary');
  const userPayload = {
    examTitle: report.examTitle,
    attempted: `${report.attemptedStudents}/${report.totalStudents}`,
    averageScore: report.averageScore,
    highestScore: report.highestScore,
    lowestScore: report.lowestScore,
    passRate: `${report.passRate}%`,
    scoreDistribution: report.scoreDistribution,
    topToppers: report.toppers.slice(0, 3).map((t) => `${t.studentName} (${t.percentage}%)`),
    weakTopics: report.weakTopics.slice(0, 5).map((t) => `${t.topic} @ ${t.averageAccuracy}%`),
  };

  const { text, outputId } = await runPrompt(tenantId, 'teacher.classSummary', {
    jsonMode: true,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
  }).catch((err) => {
    logger.warn({ err, examId }, 'ai.classSummary: provider call failed, using fallback');
    return { text: '{}', outputId: undefined };
  });

  const parsed = safeJson<Partial<ClassSummary>>(text, {});
  const fallback = heuristicClassSummary(report);
  return {
    headline: parsed.headline || fallback.headline,
    highlights:
      Array.isArray(parsed.highlights) && parsed.highlights.length
        ? parsed.highlights
        : fallback.highlights,
    concerns:
      Array.isArray(parsed.concerns) && parsed.concerns.length
        ? parsed.concerns
        : fallback.concerns,
    recommendedActions:
      Array.isArray(parsed.recommendedActions) && parsed.recommendedActions.length
        ? parsed.recommendedActions
        : fallback.recommendedActions,
    metrics,
    outputId,
  };
}

function heuristicClassSummary(
  r: Awaited<ReturnType<typeof getClassReport>>,
): Pick<ClassSummary, 'headline' | 'highlights' | 'concerns' | 'recommendedActions'> {
  const participation =
    r.totalStudents > 0 ? Math.round((r.attemptedStudents / r.totalStudents) * 100) : 0;
  const highlights: string[] = [];
  const concerns: string[] = [];
  const recommendedActions: string[] = [];

  highlights.push(
    `${r.attemptedStudents}/${r.totalStudents} students attempted (${participation}%).`,
  );
  highlights.push(`Average score: ${r.averageScore}, highest: ${r.highestScore}.`);
  if (r.passRate >= 60) highlights.push(`Pass rate of ${r.passRate}% is on track.`);

  if (r.passRate < 60) concerns.push(`Pass rate is only ${r.passRate}% — below target.`);
  if (participation < 80 && r.totalStudents > 0) {
    concerns.push(`Participation was ${participation}% — chase non-attempters.`);
  }
  if (r.weakTopics.length) {
    concerns.push(
      `Weakest topics: ${r.weakTopics
        .slice(0, 3)
        .map((t) => `${t.topic} (${t.averageAccuracy}%)`)
        .join(', ')}.`,
    );
    recommendedActions.push(
      `Reteach or assign remedial practice on: ${r.weakTopics
        .slice(0, 3)
        .map((t) => t.topic)
        .join(', ')}.`,
    );
  }
  recommendedActions.push('Publish results and share solutions with the class.');
  if (r.passRate < 60) {
    recommendedActions.push('Consider a follow-up practice exam within two weeks.');
  }

  const headline =
    r.passRate >= 60
      ? `${r.examTitle}: solid overall (avg ${r.averageScore}, ${r.passRate}% passed).`
      : `${r.examTitle}: needs attention (avg ${r.averageScore}, only ${r.passRate}% passed).`;

  return { headline, highlights, concerns, recommendedActions };
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export async function submitFeedback(tenantId: string, userId: string, input: AiFeedbackInput) {
  const prisma = getPrisma();
  await prisma.aiFeedback.upsert({
    where: { outputId: input.outputId },
    create: { tenantId, userId, outputId: input.outputId, thumbsUp: input.thumbsUp },
    update: { thumbsUp: input.thumbsUp },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// RAG: recommended practice questions
// ---------------------------------------------------------------------------

interface PracticeQuestion {
  id: string;
  text: string;
  difficulty: string;
  topic: string | null;
  marks: number;
}

/**
 * Suggests practice questions for a student by embedding a query built from
 * their weakest topics, then pgvector-similarity-searching the question bank.
 *
 * Falls back to a plain "weak topic first, hardest last" ordering when either
 * the student has no weak topics yet, or no embeddings exist for the tenant —
 * so the endpoint is useful even before the embedding backlog is populated.
 */
export async function recommendPracticeQuestions(
  tenantId: string,
  studentId: string,
  opts: { limit: number; topicId?: string },
): Promise<PracticeQuestion[]> {
  const prisma = getPrisma();
  const weak = await getWeakTopics(studentId);
  const targetTopics = weak.map((w) => w.topic).filter((n) => n.length > 0);
  const queryText = targetTopics.length
    ? `Practice questions on: ${targetTopics.slice(0, 5).join(', ')}. Focus on struggling areas.`
    : 'General practice questions across the syllabus.';

  const provider = pickProvider();
  const embed = await provider.embed(queryText).catch((err: unknown) => {
    logger.warn({ err }, 'ai.recommendPractice: embed failed');
    return null;
  });

  let ids: string[] = [];
  if (embed) {
    const literal = `[${embed.vector.join(',')}]`;
    const rows = await prisma
      .$queryRawUnsafe<{ id: string }[]>(
        `SELECT q."id"
       FROM "Question" q
       JOIN "Embedding" e
         ON e."sourceType" = 'question'
        AND e."sourceId" = q."id"
        AND e."tenantId" = q."tenantId"
       WHERE q."tenantId" = $1
         ${opts.topicId ? 'AND q."topicId" = $3' : ''}
       ORDER BY e."vector" <=> $2::vector
       LIMIT ${Math.max(1, Math.min(50, opts.limit))}`,
        tenantId,
        literal,
        ...(opts.topicId ? [opts.topicId] : []),
      )
      .catch((err: unknown) => {
        logger.warn({ err }, 'ai.recommendPractice: pgvector query failed, using fallback');
        return [] as { id: string }[];
      });
    ids = rows.map((r) => r.id);
  }

  // Fallback: no embeddings yet OR query failed. Serve from weak-topic questions.
  if (!ids.length) {
    const weakTopicIds = await prisma.topic.findMany({
      where: { name: { in: targetTopics.length ? targetTopics : undefined } },
      select: { id: true },
    });
    const fallback = await prisma.question.findMany({
      where: opts.topicId
        ? { topicId: opts.topicId }
        : weakTopicIds.length
          ? { topicId: { in: weakTopicIds.map((t) => t.id) } }
          : {},
      take: opts.limit,
      orderBy: { difficulty: 'desc' },
      select: { id: true },
    });
    ids = fallback.map((q) => q.id);
  }
  if (!ids.length) return [];

  const questions = await prisma.question.findMany({
    where: { id: { in: ids } },
    include: { topic: { select: { name: true } } },
  });
  // Preserve the order returned by the similarity search.
  const byId = new Map(questions.map((q) => [q.id, q]));
  return ids
    .map((id) => byId.get(id))
    .filter((q): q is (typeof questions)[number] => Boolean(q))
    .map((q) => ({
      id: q.id,
      text: q.text,
      difficulty: q.difficulty.toLowerCase(),
      topic: q.topic?.name ?? null,
      marks: q.marks,
    }));
}
