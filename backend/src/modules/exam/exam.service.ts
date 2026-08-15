import { type Prisma, type Exam, type ExamMode, type ExamStatus } from '@prisma/client';

import type {
  ApiExamMode,
  ApiExamStatus,
  ExamCreateInput,
  ExamListQuery,
  ExamSectionInput,
  ExamUpdateInput,
} from './exam.schemas.js';

import { AppError } from '@/common/errors/index.js';
import { getPrisma } from '@/db/prisma.js';
import { enqueueExamPublished } from '@/jobs/exam.queue.js';

// ---------------------------------------------------------------------------
// Status/mode enum translation
// ---------------------------------------------------------------------------

const STATUS_TO_API: Record<ExamStatus, ApiExamStatus> = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};
const STATUS_TO_DB: Record<ApiExamStatus, ExamStatus> = {
  draft: 'DRAFT',
  scheduled: 'SCHEDULED',
  live: 'LIVE',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

type ExamRels = Exam & {
  createdBy: { id: string; name: string } | null;
  sections: Array<{
    id: string;
    title: string;
    durationMinutes: number | null;
    order: number;
    questions: Array<{
      id: string;
      questionId: string;
      order: number;
      marksOverride: number | null;
      question: { text: string; type: string; marks: number };
    }>;
  }>;
  questions: Array<{
    id: string;
    questionId: string;
    order: number;
    marksOverride: number | null;
    sectionId: string | null;
  }>;
  assignments: Array<{
    classId: string | null;
    batchId: string | null;
    studentId: string | null;
  }>;
};

const RELATIONS = {
  createdBy: { select: { id: true, name: true } },
  sections: {
    orderBy: { order: 'asc' as const },
    include: {
      questions: {
        orderBy: { order: 'asc' as const },
        include: { question: { select: { text: true, type: true, marks: true } } },
      },
    },
  },
  questions: {
    orderBy: { order: 'asc' as const },
  },
  assignments: true,
} as const;

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

function toListItem(e: ExamRels) {
  return {
    id: e.id,
    title: e.title,
    status: STATUS_TO_API[e.status],
    mode: e.mode as ApiExamMode,
    totalMarks: e.totalMarks,
    durationMinutes: e.durationMinutes,
    questionsCount: e.questions.length,
    startAt: e.startAt?.toISOString() ?? null,
    endAt: e.endAt?.toISOString() ?? null,
    activeAttempts: 0, // populated by Phase 6 attempts module
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function toDetail(e: ExamRels) {
  const assignedClasses = e.assignments.filter((a) => a.classId).map((a) => a.classId!);
  const assignedBatches = e.assignments.filter((a) => a.batchId).map((a) => a.batchId!);
  const assignedStudents = e.assignments.filter((a) => a.studentId).map((a) => a.studentId!);

  return {
    ...toListItem(e),
    instructions: e.instructions,
    negativeMarking: e.negativeMarking,
    shuffleQuestions: e.shuffleQuestions,
    shuffleOptions: e.shuffleOptions,
    lateEntryGraceMs: e.lateEntryGraceMs,
    lockdownOnLate: e.lockdownOnLate,
    assignedClasses,
    assignedBatches,
    assignedStudents,
    sections: e.sections.map((s) => ({
      id: s.id,
      title: s.title,
      durationMinutes: s.durationMinutes,
      questions: s.questions.map((q) => ({
        questionId: q.questionId,
        questionText: q.question.text,
        questionType: q.question.type,
        marks: q.marksOverride ?? q.question.marks,
        order: q.order,
      })),
    })),
    proctoring: (e.proctoring as Record<string, unknown>) ?? {},
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listExams(query: ExamListQuery, opts: { role?: string } = {}) {
  const where: Prisma.ExamWhereInput = {};
  if (query.status) where.status = STATUS_TO_DB[query.status];
  if (query.mode) where.mode = query.mode;
  if (query.search) {
    where.title = { contains: query.search, mode: 'insensitive' };
  }
  // Students should never see draft exams — they're author-only until published.
  if (opts.role === 'STUDENT') {
    where.status = { in: ['SCHEDULED', 'LIVE', 'COMPLETED'] };
  }

  const orderBy: Prisma.ExamOrderByWithRelationInput = { [query.sortBy]: query.sortOrder };

  const prisma = getPrisma();
  const [rows, total] = await Promise.all([
    prisma.exam.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: RELATIONS,
    }),
    prisma.exam.count({ where }),
  ]);

  return {
    data: rows.map((r) => toListItem(r as ExamRels)),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getExam(id: string) {
  const e = await getPrisma().exam.findFirst({ where: { id }, include: RELATIONS });
  if (!e) throw AppError.notFound('Exam not found');
  return toDetail(e as ExamRels);
}

export async function createExam(
  tenantId: string,
  actorId: string | undefined,
  input: ExamCreateInput,
) {
  const prisma = getPrisma();
  await assertQuestionsBelong(collectQuestionIds(input.sections));
  await assertAssignmentsExist(
    tenantId,
    input.assignedClasses,
    input.assignedBatches,
    input.assignedStudents,
  );

  const exam = await prisma.$transaction(async (tx) => {
    const created = await tx.exam.create({
      data: {
        tenantId,
        createdById: actorId,
        title: input.title,
        instructions: input.instructions ?? null,
        mode: input.mode,
        durationMinutes: input.durationMinutes,
        totalMarks: input.totalMarks,
        negativeMarking: input.negativeMarking,
        shuffleQuestions: input.shuffleQuestions,
        shuffleOptions: input.shuffleOptions,
        startAt: input.startAt ? new Date(input.startAt) : null,
        endAt: input.endAt ? new Date(input.endAt) : null,
        lateEntryGraceMs: input.lateEntryGraceMs,
        lockdownOnLate: input.lockdownOnLate,
        proctoring: input.proctoring as Prisma.InputJsonValue,
      },
    });
    await writeSections(tx, tenantId, created.id, input.sections);
    await writeAssignments(
      tx,
      tenantId,
      created.id,
      input.assignedClasses,
      input.assignedBatches,
      input.assignedStudents,
    );
    return created;
  });

  return getExam(exam.id);
}

export async function updateExam(tenantId: string, id: string, input: ExamUpdateInput) {
  const prisma = getPrisma();
  const existing = await prisma.exam.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Exam not found');
  if (existing.status !== 'DRAFT') {
    throw AppError.badRequest('Only draft exams can be edited. Unpublish first.');
  }

  if (input.sections) await assertQuestionsBelong(collectQuestionIds(input.sections));
  await assertAssignmentsExist(
    tenantId,
    input.assignedClasses,
    input.assignedBatches,
    input.assignedStudents,
  );

  await prisma.$transaction(async (tx) => {
    await tx.exam.update({
      where: { id },
      data: {
        title: input.title,
        instructions: input.instructions === undefined ? undefined : input.instructions,
        mode: input.mode,
        durationMinutes: input.durationMinutes,
        totalMarks: input.totalMarks,
        negativeMarking: input.negativeMarking,
        shuffleQuestions: input.shuffleQuestions,
        shuffleOptions: input.shuffleOptions,
        startAt:
          input.startAt !== undefined
            ? input.startAt
              ? new Date(input.startAt)
              : null
            : undefined,
        endAt: input.endAt !== undefined ? (input.endAt ? new Date(input.endAt) : null) : undefined,
        lateEntryGraceMs: input.lateEntryGraceMs,
        lockdownOnLate: input.lockdownOnLate,
        proctoring: input.proctoring ? (input.proctoring as Prisma.InputJsonValue) : undefined,
      },
    });
    if (input.sections) {
      await tx.examQuestion.deleteMany({ where: { examId: id } });
      await tx.examSection.deleteMany({ where: { examId: id } });
      await writeSections(tx, tenantId, id, input.sections);
    }
    if (
      input.assignedClasses !== undefined ||
      input.assignedBatches !== undefined ||
      input.assignedStudents !== undefined
    ) {
      await tx.examAssignment.deleteMany({ where: { examId: id } });
      await writeAssignments(
        tx,
        tenantId,
        id,
        input.assignedClasses ?? [],
        input.assignedBatches ?? [],
        input.assignedStudents ?? [],
      );
    }
  });

  return getExam(id);
}

export async function deleteExam(id: string) {
  const existing = await getPrisma().exam.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Exam not found');
  if (existing.status === 'LIVE') {
    throw AppError.badRequest('Cannot delete an exam that is currently live');
  }
  await getPrisma().exam.delete({ where: { id } });
}

export async function publishExam(tenantId: string, id: string) {
  const prisma = getPrisma();
  const exam = await prisma.exam.findFirst({
    where: { id },
    include: { questions: true, assignments: true },
  });
  if (!exam) throw AppError.notFound('Exam not found');
  if (exam.status !== 'DRAFT') throw AppError.badRequest('Exam is already published');

  validatePublishable(exam, exam.questions);

  await prisma.exam.update({
    where: { id },
    data: { status: 'SCHEDULED', publishedAt: new Date() },
  });

  await enqueueExamPublished({ tenantId, examId: id });
  return getExam(id);
}

export async function unpublishExam(id: string) {
  const existing = await getPrisma().exam.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Exam not found');
  if (existing.status !== 'SCHEDULED') {
    throw AppError.badRequest('Only scheduled (not-yet-live) exams can be unpublished');
  }
  await getPrisma().exam.update({
    where: { id },
    data: { status: 'DRAFT', publishedAt: null },
  });
  return getExam(id);
}

export async function duplicateExam(tenantId: string, actorId: string | undefined, id: string) {
  const src = await getPrisma().exam.findFirst({
    where: { id },
    include: {
      sections: { include: { questions: true } },
      questions: true,
      assignments: true,
    },
  });
  if (!src) throw AppError.notFound('Exam not found');

  const prisma = getPrisma();
  const copy = await prisma.$transaction(async (tx) => {
    const created = await tx.exam.create({
      data: {
        tenantId,
        createdById: actorId,
        title: `${src.title} (Copy)`,
        instructions: src.instructions,
        mode: src.mode,
        durationMinutes: src.durationMinutes,
        totalMarks: src.totalMarks,
        negativeMarking: src.negativeMarking,
        shuffleQuestions: src.shuffleQuestions,
        shuffleOptions: src.shuffleOptions,
        lateEntryGraceMs: src.lateEntryGraceMs,
        lockdownOnLate: src.lockdownOnLate,
        proctoring: src.proctoring as Prisma.InputJsonValue,
        status: 'DRAFT',
      },
    });

    for (const s of src.sections) {
      const newSection = await tx.examSection.create({
        data: {
          tenantId,
          examId: created.id,
          title: s.title,
          durationMinutes: s.durationMinutes,
          order: s.order,
        },
      });
      if (s.questions.length) {
        await tx.examQuestion.createMany({
          data: s.questions.map((q) => ({
            tenantId,
            examId: created.id,
            sectionId: newSection.id,
            questionId: q.questionId,
            order: q.order,
            marksOverride: q.marksOverride,
          })),
        });
      }
    }
    return created;
  });

  return getExam(copy.id);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectQuestionIds(sections: ExamSectionInput[]): string[] {
  return sections.flatMap((s) => s.questions.map((q) => q.questionId));
}

async function assertQuestionsBelong(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const unique = Array.from(new Set(ids));
  const count = await getPrisma().question.count({ where: { id: { in: unique } } });
  if (count !== unique.length) {
    throw AppError.badRequest('One or more questions do not exist in this tenant');
  }
}

async function assertAssignmentsExist(
  _tenantId: string,
  classIds: string[] | undefined,
  batchIds: string[] | undefined,
  studentIds: string[] | undefined,
): Promise<void> {
  const prisma = getPrisma();
  if (classIds?.length) {
    const n = await prisma.class.count({ where: { id: { in: classIds } } });
    if (n !== new Set(classIds).size) throw AppError.badRequest('Unknown class in assignment');
  }
  if (batchIds?.length) {
    const n = await prisma.batch.count({ where: { id: { in: batchIds } } });
    if (n !== new Set(batchIds).size) throw AppError.badRequest('Unknown batch in assignment');
  }
  if (studentIds?.length) {
    const n = await prisma.user.count({
      where: { id: { in: studentIds }, role: 'STUDENT' },
    });
    if (n !== new Set(studentIds).size) throw AppError.badRequest('Unknown student in assignment');
  }
}

async function writeSections(
  tx: Prisma.TransactionClient,
  tenantId: string,
  examId: string,
  sections: ExamSectionInput[],
): Promise<void> {
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]!;
    const created = await tx.examSection.create({
      data: {
        tenantId,
        examId,
        title: s.title,
        durationMinutes: s.durationMinutes ?? null,
        order: i,
      },
    });
    if (s.questions.length) {
      await tx.examQuestion.createMany({
        data: s.questions.map((q, qi) => ({
          tenantId,
          examId,
          sectionId: created.id,
          questionId: q.questionId,
          order: q.order ?? qi,
          marksOverride: q.marks,
        })),
      });
    }
  }
}

async function writeAssignments(
  tx: Prisma.TransactionClient,
  tenantId: string,
  examId: string,
  classIds: string[],
  batchIds: string[],
  studentIds: string[],
): Promise<void> {
  const rows: Prisma.ExamAssignmentCreateManyInput[] = [];
  for (const classId of classIds) rows.push({ tenantId, examId, classId });
  for (const batchId of batchIds) rows.push({ tenantId, examId, batchId });
  for (const studentId of studentIds) rows.push({ tenantId, examId, studentId });
  if (rows.length) await tx.examAssignment.createMany({ data: rows, skipDuplicates: true });
}

function validatePublishable(
  exam: Exam & { mode: ExamMode; status: ExamStatus },
  examQuestions: Array<{ marksOverride: number | null }>,
): void {
  if (!examQuestions.length) {
    throw AppError.badRequest('Exam must contain at least one question before publishing');
  }
  const total = examQuestions.reduce((sum, q) => sum + (q.marksOverride ?? 0), 0);
  if (Math.abs(total - exam.totalMarks) > 0.001) {
    throw AppError.badRequest(
      `Sum of question marks (${total}) does not match totalMarks (${exam.totalMarks})`,
    );
  }
  if (exam.startAt && exam.startAt.getTime() < Date.now()) {
    throw AppError.badRequest('startAt must be in the future');
  }
  if (exam.mode === 'SYNCHRONOUS') {
    if (!exam.startAt || !exam.durationMinutes) {
      throw AppError.badRequest('SYNCHRONOUS exams require startAt and durationMinutes');
    }
  }
}
