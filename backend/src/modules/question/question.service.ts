import { Prisma, type Question, type QuestionDifficulty, type QuestionType } from '@prisma/client';

import type {
  ApiDifficulty,
  QuestionCreateInput,
  QuestionListQuery,
  QuestionUpdateInput,
} from './question.schemas.js';

import { AppError } from '@/common/errors/index.js';
import { logger } from '@/common/logger.js';
import { getPrisma } from '@/db/prisma.js';
import { enqueueEmbedding } from '@/jobs/embedding.queue.js';

// ---------------------------------------------------------------------------
// Difficulty enum translation (API lowercase ↔ DB uppercase)
// ---------------------------------------------------------------------------

const DIFF_TO_DB: Record<ApiDifficulty, QuestionDifficulty> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
};
const DIFF_TO_API: Record<QuestionDifficulty, ApiDifficulty> = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

// ---------------------------------------------------------------------------
// Type-payload normalisation
// The DB stores `content` as opaque JSON. The API surface flattens options,
// tolerance, unit, blanks, imageUrl, rubric into first-class fields to match
// the frontend contract. These two helpers do the round-trip.
// ---------------------------------------------------------------------------

interface PayloadShape {
  content: Prisma.InputJsonValue;
  correctAnswer: Prisma.InputJsonValue | null;
}

function toContent(input: QuestionCreateInput): PayloadShape {
  switch (input.type) {
    case 'MCQ':
    case 'MSQ':
      return {
        content: { options: input.options },
        correctAnswer:
          input.type === 'MCQ'
            ? (input.options.find((o) => o.isCorrect)?.id ?? null)
            : input.options.filter((o) => o.isCorrect).map((o) => o.id),
      };
    case 'TRUE_FALSE':
      return { content: {}, correctAnswer: input.correctAnswer };
    case 'FILL_BLANK':
      return { content: { blanks: input.blanks }, correctAnswer: input.blanks };
    case 'NUMERICAL':
      return {
        content: { tolerance: input.tolerance ?? 0, unit: input.unit ?? null },
        correctAnswer: input.correctAnswer,
      };
    case 'SHORT_ANSWER':
    case 'LONG_ANSWER':
      return {
        content: { rubric: input.rubric ?? null, modelAnswer: input.modelAnswer },
        correctAnswer: input.modelAnswer,
      };
    case 'IMAGE_BASED':
      return {
        content: { imageUrl: input.imageUrl, options: input.options },
        correctAnswer: input.options.filter((o) => o.isCorrect).map((o) => o.id),
      };
  }
}

interface FlatOut {
  options: unknown[] | null;
  tolerance: number | null;
  unit: string | null;
  blanks: string[] | null;
  imageUrl: string | null;
  rubric: string | null;
}

function fromContent(type: QuestionType, content: unknown): FlatOut {
  const c = (content ?? {}) as Record<string, unknown>;
  const opts = Array.isArray(c.options) ? (c.options as unknown[]) : null;
  const blanks = Array.isArray(c.blanks) ? (c.blanks as string[]) : null;
  return {
    options: type === 'MCQ' || type === 'MSQ' || type === 'IMAGE_BASED' ? opts : null,
    tolerance: type === 'NUMERICAL' && typeof c.tolerance === 'number' ? c.tolerance : null,
    unit: type === 'NUMERICAL' && typeof c.unit === 'string' ? c.unit : null,
    blanks: type === 'FILL_BLANK' ? blanks : null,
    imageUrl: type === 'IMAGE_BASED' && typeof c.imageUrl === 'string' ? c.imageUrl : null,
    rubric:
      (type === 'SHORT_ANSWER' || type === 'LONG_ANSWER') && typeof c.rubric === 'string'
        ? c.rubric
        : null,
  };
}

// ---------------------------------------------------------------------------
// Public serializers
// ---------------------------------------------------------------------------

type QuestionWithRels = Question & {
  subject: { id: string; name: string };
  topic: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  tenant?: { id: string; name: string } | null;
};

function toListItem(q: QuestionWithRels) {
  return {
    id: q.id,
    text: q.text,
    type: q.type,
    subjectId: q.subjectId,
    subjectName: q.subject.name,
    topicId: q.topicId,
    topicName: q.topic?.name ?? null,
    difficulty: DIFF_TO_API[q.difficulty],
    tags: q.tags,
    marks: q.marks,
    tenantId: q.tenantId,
    tenantName: q.tenant?.name ?? null,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

function toDetail(q: QuestionWithRels) {
  const flat = fromContent(q.type, q.content);
  return {
    ...toListItem(q),
    negativeMarks: q.negativeMarks,
    options: flat.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    rubric: flat.rubric,
    imageUrl: flat.imageUrl,
    tolerance: flat.tolerance,
    unit: flat.unit,
    blanks: flat.blanks,
    currentVersion: q.currentVersion,
    createdBy: q.createdBy?.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const RELATIONS = {
  tenant: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true } },
  topic: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

export async function listQuestions(query: QuestionListQuery) {
  const where: Prisma.QuestionWhereInput = {};
  if (query.subjectId) where.subjectId = query.subjectId;
  if (query.topicId) where.topicId = query.topicId;
  if (query.type) where.type = query.type;
  if (query.difficulty) where.difficulty = DIFF_TO_DB[query.difficulty];
  if (query.tags?.length) where.tags = { hasSome: query.tags };
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.search) {
    where.OR = [
      { text: { contains: query.search, mode: 'insensitive' } },
      { tags: { has: query.search } },
    ];
  }

  const orderBy: Prisma.QuestionOrderByWithRelationInput = {
    [query.sortBy]: query.sortOrder,
  };

  const prisma = getPrisma();
  const [rows, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: RELATIONS,
    }),
    prisma.question.count({ where }),
  ]);

  return {
    data: rows.map((r) => toListItem(r as QuestionWithRels)),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getQuestion(id: string) {
  const q = await getPrisma().question.findFirst({ where: { id }, include: RELATIONS });
  if (!q) throw AppError.notFound('Question not found');
  return toDetail(q as QuestionWithRels);
}

export async function createQuestion(
  tenantId: string,
  actorId: string | undefined,
  input: QuestionCreateInput,
) {
  const payload = toContent(input);
  const prisma = getPrisma();

  await assertSubjectAndTopic(input.subjectId, input.topicId ?? null);

  const q = await prisma.question.create({
    data: {
      tenantId,
      subjectId: input.subjectId,
      topicId: input.topicId ?? null,
      createdById: actorId,
      type: input.type,
      text: input.text,
      difficulty: DIFF_TO_DB[input.difficulty],
      marks: input.marks,
      negativeMarks: input.negativeMarks,
      tags: input.tags,
      explanation: input.explanation ?? null,
      content: payload.content,
      correctAnswer: payload.correctAnswer ?? Prisma.DbNull,
    },
    include: RELATIONS,
  });

  await writeSnapshot(tenantId, q.id, 1, actorId, input, payload);
  scheduleEmbedding(tenantId, q.id, input.text, input.explanation ?? null);
  return toDetail(q as QuestionWithRels);
}

export async function updateQuestion(
  tenantId: string,
  actorId: string | undefined,
  id: string,
  input: QuestionUpdateInput,
) {
  const prisma = getPrisma();
  const existing = await prisma.question.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Question not found');

  await assertSubjectAndTopic(input.subjectId, input.topicId ?? null);

  const payload = toContent(input);
  const nextVersion = existing.currentVersion + 1;

  const q = await prisma.question.update({
    where: { id },
    data: {
      subjectId: input.subjectId,
      topicId: input.topicId ?? null,
      type: input.type,
      text: input.text,
      difficulty: DIFF_TO_DB[input.difficulty],
      marks: input.marks,
      negativeMarks: input.negativeMarks,
      tags: input.tags,
      explanation: input.explanation ?? null,
      content: payload.content,
      correctAnswer: payload.correctAnswer ?? Prisma.DbNull,
      currentVersion: nextVersion,
    },
    include: RELATIONS,
  });

  await writeSnapshot(tenantId, q.id, nextVersion, actorId, input, payload);
  scheduleEmbedding(tenantId, q.id, input.text, input.explanation ?? null);
  return toDetail(q as QuestionWithRels);
}

/**
 * Enqueue an embedding refresh. Fire-and-forget: a failing enqueue must never
 * block the user's save. The worker is idempotent on (tenant, source, id).
 */
function scheduleEmbedding(
  tenantId: string,
  questionId: string,
  text: string,
  explanation: string | null,
): void {
  const combined = explanation ? `${text}\n\n${explanation}` : text;
  enqueueEmbedding({
    tenantId,
    sourceType: 'question',
    sourceId: questionId,
    text: combined,
  }).catch((err: unknown) => logger.warn({ err, questionId }, 'embedding enqueue failed'));
}

export async function deleteQuestion(id: string) {
  const existing = await getPrisma().question.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Question not found');
  await getPrisma().question.delete({ where: { id } });
}

export async function listVersions(questionId: string) {
  const rows = await getPrisma().questionVersion.findMany({
    where: { questionId },
    orderBy: { version: 'desc' },
    include: { editedBy: { select: { id: true, name: true } } },
  });
  return rows.map((v) => ({
    id: v.id,
    questionId: v.questionId,
    version: v.version,
    editedBy: v.editedBy?.name ?? null,
    editedById: v.editedById,
    createdAt: v.createdAt.toISOString(),
    type: v.type,
    text: v.text,
    difficulty: DIFF_TO_API[v.difficulty],
    marks: v.marks,
    negativeMarks: v.negativeMarks,
    tags: v.tags,
    content: v.content,
    correctAnswer: v.correctAnswer,
    explanation: v.explanation,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeSnapshot(
  tenantId: string,
  questionId: string,
  version: number,
  editedById: string | undefined,
  input: QuestionCreateInput,
  payload: PayloadShape,
) {
  await getPrisma().questionVersion.create({
    data: {
      tenantId,
      questionId,
      version,
      editedById,
      type: input.type,
      text: input.text,
      difficulty: DIFF_TO_DB[input.difficulty],
      marks: input.marks,
      negativeMarks: input.negativeMarks,
      tags: input.tags,
      content: payload.content,
      correctAnswer: payload.correctAnswer ?? Prisma.DbNull,
      explanation: input.explanation ?? null,
    },
  });
}

async function assertSubjectAndTopic(subjectId: string, topicId: string | null): Promise<void> {
  const prisma = getPrisma();
  const subj = await prisma.subject.findFirst({ where: { id: subjectId }, select: { id: true } });
  if (!subj) throw AppError.badRequest('Unknown subject');
  if (topicId) {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, subjectId },
      select: { id: true },
    });
    if (!topic) throw AppError.badRequest('Topic does not belong to that subject');
  }
}
