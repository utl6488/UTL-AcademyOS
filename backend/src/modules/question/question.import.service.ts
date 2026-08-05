import { Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';

import { QuestionCreateSchema, type QuestionCreateInput } from './question.schemas.js';

import { AppError } from '@/common/errors/index.js';
import { createPresignedUpload, fetchObject } from '@/common/s3.js';
import { env } from '@/config/env.js';
import { getPrisma } from '@/db/prisma.js';
import { enqueueImport } from '@/jobs/import.queue.js';

interface RowError {
  row: number;
  field: string;
  message: string;
}

const REQUIRED_HEADERS = ['type', 'text', 'subjectid', 'difficulty', 'marks'] as const;

// CSV columns supported:
//   type, text, subjectid, topicid, difficulty, marks, negativemarks, tags,
//   explanation, options, correctanswer, tolerance, unit, blanks, imageurl,
//   modelanswer, rubric
//
// - `options` for MCQ/MSQ/IMAGE_BASED: pipe-separated `Text*|Text|Text*` where a
//   trailing `*` marks the option correct.
// - `tags`, `blanks`: pipe-separated.
// - `correctanswer` for TRUE_FALSE: "true"/"false".

export async function createUploadUrl(tenantId: string, fileName: string, contentType: string) {
  const upload = await createPresignedUpload({
    kind: 'import',
    tenantId,
    fileName,
    contentType,
    subfolder: 'questions',
  });
  return { uploadUrl: upload.uploadUrl, fileKey: upload.fileKey };
}

export async function startImport(opts: { tenantId: string; actorId: string; fileKey: string }) {
  const job = await getPrisma().importJob.create({
    data: {
      tenantId: opts.tenantId,
      actorId: opts.actorId,
      kind: 'QUESTION',
      fileKey: opts.fileKey,
      status: 'PENDING',
      meta: {},
    },
  });
  await enqueueImport({ jobId: job.id });
  return { jobId: job.id };
}

export async function getJob(jobId: string) {
  const j = await getPrisma().importJob.findFirst({ where: { id: jobId } });
  if (!j) throw AppError.notFound('Import job not found');
  return {
    id: j.id,
    status: j.status,
    kind: j.kind,
    totalRows: j.totalRows,
    processedRows: j.processedRows,
    successCount: j.successCount,
    errorCount: j.errorCount,
    errors: j.errors,
    createdAt: j.createdAt.toISOString(),
    completedAt: j.completedAt?.toISOString() ?? null,
  };
}

export async function runQuestionImportJob(jobId: string): Promise<void> {
  const prisma = getPrisma();
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Import job ${jobId} not found`);

  await prisma.importJob.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });

  try {
    const buffer = await fetchObject(env.S3_BUCKET_UPLOADS, job.fileKey);
    const rows = parse(buffer, {
      columns: (h: string[]) => h.map((c) => c.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;

    const headers = rows.length ? Object.keys(rows[0] ?? {}) : [];
    const errors: RowError[] = [];
    for (const h of REQUIRED_HEADERS) {
      if (!headers.includes(h)) {
        errors.push({ row: 0, field: h, message: `Missing required column "${h}"` });
      }
    }

    let successCount = 0;
    let processed = 0;

    for (const row of rows) {
      processed++;
      try {
        const parsed = QuestionCreateSchema.safeParse(rowToQuestion(row));
        if (!parsed.success) {
          const first = parsed.error.errors[0];
          errors.push({
            row: processed + 1,
            field: first?.path.join('.') || 'row',
            message: first?.message ?? 'Validation failed',
          });
          continue;
        }

        const input = parsed.data;
        const content = toContent(input);
        await prisma.question.create({
          data: {
            tenantId: job.tenantId,
            subjectId: input.subjectId,
            topicId: input.topicId ?? null,
            createdById: job.actorId,
            type: input.type,
            text: input.text,
            difficulty:
              input.difficulty === 'easy'
                ? 'EASY'
                : input.difficulty === 'hard'
                  ? 'HARD'
                  : 'MEDIUM',
            marks: input.marks,
            negativeMarks: input.negativeMarks,
            tags: input.tags,
            explanation: input.explanation ?? null,
            content,
            correctAnswer:
              input.type === 'MCQ' || input.type === 'MSQ' || input.type === 'IMAGE_BASED'
                ? computeCorrect(input)
                : (input as { correctAnswer?: unknown }).correctAnswer !== undefined
                  ? ((input as { correctAnswer?: unknown }).correctAnswer as Prisma.InputJsonValue)
                  : Prisma.DbNull,
          },
        });
        successCount++;
      } catch (err) {
        errors.push({
          row: processed + 1,
          field: 'row',
          message: err instanceof Error ? err.message : 'Insert failed',
        });
      }

      if (processed % 25 === 0) {
        await prisma.importJob.update({
          where: { id: job.id },
          data: { processedRows: processed, successCount, errorCount: errors.length },
        });
      }
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        totalRows: rows.length,
        processedRows: processed,
        successCount,
        errorCount: errors.length,
        errors: errors as never,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errors: [
          { row: 0, field: 'file', message: err instanceof Error ? err.message : String(err) },
        ] as never,
      },
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Streamed export — returns CSV text. Not truly streamed since Prisma buffers,
// but keeps memory bounded by paging in chunks.
// ---------------------------------------------------------------------------

interface ExportFilters {
  subjectId?: string;
  topicId?: string;
  type?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export async function exportQuestions(filters: ExportFilters): Promise<string> {
  const where: Prisma.QuestionWhereInput = {};
  if (filters.subjectId) where.subjectId = filters.subjectId;
  if (filters.topicId) where.topicId = filters.topicId;
  if (filters.type) where.type = filters.type as Prisma.QuestionWhereInput['type'];
  if (filters.difficulty) {
    where.difficulty =
      filters.difficulty === 'easy' ? 'EASY' : filters.difficulty === 'hard' ? 'HARD' : 'MEDIUM';
  }

  const chunk = 500;
  const header = [
    'id',
    'type',
    'text',
    'subjectid',
    'topicid',
    'difficulty',
    'marks',
    'negativemarks',
    'tags',
    'explanation',
    'options',
    'correctanswer',
    'tolerance',
    'unit',
    'blanks',
    'imageurl',
    'modelanswer',
    'rubric',
  ];
  const lines = [header.join(',')];

  let skip = 0;
  for (;;) {
    const rows = await getPrisma().question.findMany({
      where,
      skip,
      take: chunk,
      orderBy: { createdAt: 'asc' },
    });
    if (!rows.length) break;
    for (const r of rows) {
      const content = (r.content ?? {}) as Record<string, unknown>;
      const options = Array.isArray(content.options)
        ? (content.options as Array<{ text: string; isCorrect: boolean }>)
            .map((o) => `${o.text}${o.isCorrect ? '*' : ''}`)
            .join('|')
        : '';
      const blanks = Array.isArray(content.blanks) ? (content.blanks as string[]).join('|') : '';
      lines.push(
        [
          r.id,
          r.type,
          r.text,
          r.subjectId,
          r.topicId ?? '',
          r.difficulty.toLowerCase(),
          r.marks,
          r.negativeMarks,
          r.tags.join('|'),
          r.explanation ?? '',
          options,
          r.correctAnswer !== null && r.correctAnswer !== undefined
            ? JSON.stringify(r.correctAnswer)
            : '',
          typeof content.tolerance === 'number' ? content.tolerance : '',
          typeof content.unit === 'string' ? content.unit : '',
          blanks,
          typeof content.imageUrl === 'string' ? content.imageUrl : '',
          typeof (content as { modelAnswer?: unknown }).modelAnswer === 'string'
            ? (content as { modelAnswer: string }).modelAnswer
            : '',
          typeof content.rubric === 'string' ? content.rubric : '',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    if (rows.length < chunk) break;
    skip += chunk;
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Row → API shape adapter for the CSV importer
// ---------------------------------------------------------------------------

function rowToQuestion(row: Record<string, string>): Record<string, unknown> {
  const type = row.type?.toUpperCase();
  const base: Record<string, unknown> = {
    type,
    text: row.text ?? '',
    subjectId: row.subjectid ?? '',
    topicId: row.topicid || undefined,
    difficulty: (row.difficulty || 'medium').toLowerCase(),
    marks: row.marks || 1,
    negativeMarks: row.negativemarks || 0,
    tags: row.tags
      ? row.tags
          .split('|')
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    explanation: row.explanation || undefined,
  };

  switch (type) {
    case 'MCQ':
    case 'MSQ':
    case 'IMAGE_BASED':
      base.options = parseOptions(row.options);
      if (type === 'IMAGE_BASED') base.imageUrl = row.imageurl;
      break;
    case 'TRUE_FALSE':
      base.correctAnswer = /^true$/i.test(row.correctanswer ?? '');
      break;
    case 'FILL_BLANK':
      base.blanks = row.blanks ? row.blanks.split('|').map((t) => t.trim()) : [];
      break;
    case 'NUMERICAL':
      base.correctAnswer = Number(row.correctanswer);
      base.tolerance = row.tolerance ? Number(row.tolerance) : 0;
      base.unit = row.unit || undefined;
      break;
    case 'SHORT_ANSWER':
    case 'LONG_ANSWER':
      base.modelAnswer = row.modelanswer ?? '';
      base.rubric = row.rubric || undefined;
      break;
  }
  return base;
}

function parseOptions(
  v: string | undefined,
): Array<{ id: string; text: string; isCorrect: boolean }> {
  if (!v) return [];
  return v.split('|').map((raw, i) => {
    const isCorrect = raw.endsWith('*');
    const text = isCorrect ? raw.slice(0, -1) : raw;
    return { id: `opt-${i + 1}`, text: text.trim(), isCorrect };
  });
}

function toContent(input: QuestionCreateInput): Prisma.InputJsonValue {
  switch (input.type) {
    case 'MCQ':
    case 'MSQ':
      return { options: input.options };
    case 'IMAGE_BASED':
      return { options: input.options, imageUrl: input.imageUrl };
    case 'NUMERICAL':
      return { tolerance: input.tolerance ?? 0, unit: input.unit ?? null };
    case 'FILL_BLANK':
      return { blanks: input.blanks };
    case 'SHORT_ANSWER':
    case 'LONG_ANSWER':
      return { rubric: input.rubric ?? null, modelAnswer: input.modelAnswer };
    case 'TRUE_FALSE':
      return {};
  }
}

function computeCorrect(input: QuestionCreateInput): Prisma.InputJsonValue {
  if (input.type === 'MCQ') return input.options.find((o) => o.isCorrect)?.id ?? '';
  if (input.type === 'MSQ' || input.type === 'IMAGE_BASED') {
    return input.options.filter((o) => o.isCorrect).map((o) => o.id);
  }
  return '';
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
