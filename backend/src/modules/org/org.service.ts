import { Prisma } from '@prisma/client';

import { AppError } from '@/common/errors/index.js';
import { getPrisma } from '@/db/prisma.js';

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export async function listBranches(filters: { tenantId?: string } = {}) {
  const rows = await getPrisma().branch.findMany({
    where: filters.tenantId ? { tenantId: filters.tenantId } : undefined,
    include: { tenant: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    address: b.address,
    isActive: b.isActive,
    tenantId: b.tenantId,
    tenantName: b.tenant?.name ?? null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));
}

export async function createBranch(data: Prisma.BranchUncheckedCreateInput) {
  try {
    return await getPrisma().branch.create({ data });
  } catch (err) {
    throw wrapUnique(err, 'A branch with that name already exists');
  }
}

export async function updateBranch(id: string, data: Prisma.BranchUncheckedUpdateInput) {
  const existing = await getPrisma().branch.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Branch not found');
  try {
    return await getPrisma().branch.update({ where: { id }, data });
  } catch (err) {
    throw wrapUnique(err, 'A branch with that name already exists');
  }
}

export async function deleteBranch(id: string) {
  const existing = await getPrisma().branch.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Branch not found');
  await getPrisma().branch.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Academic Years — one row per academic year per tenant.
// Only one may be `isCurrent` at a time; flipping it clears the others.
// ---------------------------------------------------------------------------

export function listAcademicYears() {
  return getPrisma().academicYear.findMany({ orderBy: { startDate: 'desc' } });
}

export async function createAcademicYear(
  tenantId: string,
  data: { name: string; startDate: Date; endDate: Date; isCurrent?: boolean },
) {
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(async (tx) => {
      if (data.isCurrent) {
        await tx.academicYear.updateMany({
          where: { isCurrent: true },
          data: { isCurrent: false },
        });
      }
      return tx.academicYear.create({
        data: {
          tenantId,
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          isCurrent: data.isCurrent ?? false,
        },
      });
    });
  } catch (err) {
    throw wrapUnique(err, 'An academic year with that name already exists');
  }
}

export async function updateAcademicYear(
  id: string,
  data: { name?: string; startDate?: Date; endDate?: Date; isCurrent?: boolean },
) {
  const prisma = getPrisma();
  const existing = await prisma.academicYear.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Academic year not found');

  try {
    return await prisma.$transaction(async (tx) => {
      if (data.isCurrent === true) {
        await tx.academicYear.updateMany({
          where: { isCurrent: true, NOT: { id } },
          data: { isCurrent: false },
        });
      }
      return tx.academicYear.update({ where: { id }, data });
    });
  } catch (err) {
    throw wrapUnique(err, 'An academic year with that name already exists');
  }
}

export async function deleteAcademicYear(id: string) {
  const existing = await getPrisma().academicYear.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Academic year not found');
  await getPrisma().academicYear.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Classes (+ sections)
// ---------------------------------------------------------------------------

export async function listClasses(filters: { branchId?: string; tenantId?: string }) {
  const where: Prisma.ClassWhereInput = {};
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.tenantId) where.tenantId = filters.tenantId;
  const rows = await getPrisma().class.findMany({
    where,
    include: {
      tenant: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      sections: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
    },
    orderBy: [{ numericOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    numericOrder: c.numericOrder,
    branchId: c.branchId,
    branchName: c.branch?.name ?? null,
    sections: c.sections,
    tenantId: c.tenantId,
    tenantName: c.tenant?.name ?? null,
    createdAt: c.createdAt,
  }));
}

export async function createClass(
  tenantId: string,
  data: { name: string; numericOrder: number; branchId?: string; sections: string[] },
) {
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(async (tx) => {
      const cls = await tx.class.create({
        data: {
          tenantId,
          name: data.name,
          numericOrder: data.numericOrder,
          branchId: data.branchId,
        },
      });
      if (data.sections.length) {
        await tx.section.createMany({
          data: data.sections.map((name) => ({ tenantId, classId: cls.id, name })),
          skipDuplicates: true,
        });
      }
      return cls;
    });
  } catch (err) {
    throw wrapUnique(err, 'A class with that name already exists');
  }
}

export async function updateClass(
  tenantId: string,
  id: string,
  data: { name?: string; numericOrder?: number; branchId?: string | null; sections?: string[] },
) {
  const prisma = getPrisma();
  const existing = await prisma.class.findFirst({ where: { id }, include: { sections: true } });
  if (!existing) throw AppError.notFound('Class not found');

  return prisma.$transaction(async (tx) => {
    const cls = await tx.class.update({
      where: { id },
      data: {
        name: data.name,
        numericOrder: data.numericOrder,
        branchId: data.branchId === null ? null : (data.branchId ?? undefined),
      },
    });
    if (data.sections) {
      const wanted = new Set(data.sections);
      const existingByName = new Map(existing.sections.map((s) => [s.name, s]));
      const toDelete = existing.sections.filter((s) => !wanted.has(s.name)).map((s) => s.id);
      const toCreate = data.sections
        .filter((n) => !existingByName.has(n))
        .map((n) => ({ tenantId, classId: cls.id, name: n }));
      if (toDelete.length) {
        await tx.section.deleteMany({ where: { id: { in: toDelete } } });
      }
      if (toCreate.length) {
        await tx.section.createMany({ data: toCreate });
      }
    }
    return cls;
  });
}

export async function deleteClass(id: string) {
  const existing = await getPrisma().class.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Class not found');
  await getPrisma().class.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

export async function listBatches(filters: { classId?: string; tenantId?: string }) {
  const where: Prisma.BatchWhereInput = {};
  if (filters.classId) where.classId = filters.classId;
  if (filters.tenantId) where.tenantId = filters.tenantId;
  const rows = await getPrisma().batch.findMany({
    where,
    include: {
      tenant: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: 'asc' },
  });
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    classId: b.classId,
    className: b.class.name,
    teacherId: b.teacherId,
    teacherName: b.teacher?.name ?? null,
    studentCount: b._count.members,
    isActive: b.isActive,
    tenantId: b.tenantId,
    tenantName: b.tenant?.name ?? null,
    createdAt: b.createdAt,
  }));
}

export async function createBatch(
  tenantId: string,
  data: {
    name: string;
    classId: string;
    teacherId?: string;
    studentIds?: string[];
    isActive?: boolean;
  },
) {
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.create({
        data: {
          tenantId,
          name: data.name,
          classId: data.classId,
          teacherId: data.teacherId,
          isActive: data.isActive ?? true,
        },
      });
      if (data.studentIds?.length) {
        await tx.batchMember.createMany({
          data: data.studentIds.map((userId) => ({ batchId: batch.id, userId })),
          skipDuplicates: true,
        });
      }
      return batch;
    });
  } catch (err) {
    throw wrapUnique(err, 'A batch with that name already exists');
  }
}

export async function updateBatch(
  id: string,
  data: {
    name?: string;
    classId?: string;
    teacherId?: string;
    studentIds?: string[];
    isActive?: boolean;
  },
) {
  const prisma = getPrisma();
  const existing = await prisma.batch.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Batch not found');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.batch.update({
      where: { id },
      data: {
        name: data.name,
        classId: data.classId,
        teacherId: data.teacherId,
        isActive: data.isActive,
      },
    });
    if (data.studentIds) {
      await tx.batchMember.deleteMany({ where: { batchId: id } });
      if (data.studentIds.length) {
        await tx.batchMember.createMany({
          data: data.studentIds.map((userId) => ({ batchId: id, userId })),
          skipDuplicates: true,
        });
      }
    }
    return updated;
  });
}

export async function deleteBatch(id: string) {
  const existing = await getPrisma().batch.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Batch not found');
  await getPrisma().batch.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export async function listSubjects(filters: { classId?: string; tenantId?: string }) {
  const where: Prisma.SubjectWhereInput = {};
  if (filters.classId) where.classes = { some: { id: filters.classId } };
  if (filters.tenantId) where.tenantId = filters.tenantId;
  const rows = await getPrisma().subject.findMany({
    where,
    include: {
      tenant: { select: { id: true, name: true } },
      classes: { select: { id: true } },
      _count: { select: { topics: true } },
    },
    orderBy: { name: 'asc' },
  });
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    classIds: s.classes.map((c) => c.id),
    topicCount: s._count.topics,
    tenantId: s.tenantId,
    tenantName: s.tenant?.name ?? null,
    createdAt: s.createdAt,
  }));
}

export async function createSubject(
  tenantId: string,
  data: { name: string; code?: string; classIds: string[] },
) {
  try {
    return await getPrisma().subject.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code,
        classes: { connect: data.classIds.map((id) => ({ id })) },
      },
    });
  } catch (err) {
    throw wrapUnique(err, 'A subject with that name already exists');
  }
}

export async function updateSubject(
  id: string,
  data: { name?: string; code?: string; classIds?: string[] },
) {
  const existing = await getPrisma().subject.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Subject not found');
  return getPrisma().subject.update({
    where: { id },
    data: {
      name: data.name,
      code: data.code,
      classes: data.classIds ? { set: data.classIds.map((id) => ({ id })) } : undefined,
    },
  });
}

export async function deleteSubject(id: string) {
  const existing = await getPrisma().subject.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Subject not found');
  await getPrisma().subject.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Topics — nested tree (parentId)
// ---------------------------------------------------------------------------

interface TopicNode {
  id: string;
  name: string;
  subjectId: string;
  parentId: string | null;
  order: number;
  createdAt: Date;
  children: TopicNode[];
}

export async function listTopicsForSubject(subjectId: string): Promise<TopicNode[]> {
  const rows = await getPrisma().topic.findMany({
    where: { subjectId },
    orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { name: 'asc' }],
  });
  const byId = new Map<string, TopicNode>();
  const roots: TopicNode[] = [];
  for (const r of rows) {
    byId.set(r.id, { ...r, children: [] });
  }
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parentId && byId.has(r.parentId)) byId.get(r.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export async function createTopic(
  tenantId: string,
  data: { name: string; subjectId: string; parentId?: string; order?: number },
) {
  return getPrisma().topic.create({
    data: {
      tenantId,
      name: data.name,
      subjectId: data.subjectId,
      parentId: data.parentId,
      order: data.order ?? 0,
    },
  });
}

export async function updateTopic(
  id: string,
  data: { name?: string; parentId?: string; order?: number },
) {
  const existing = await getPrisma().topic.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Topic not found');
  if (data.parentId && data.parentId === id) {
    throw AppError.badRequest('Topic cannot be its own parent');
  }
  return getPrisma().topic.update({
    where: { id },
    data: { name: data.name, parentId: data.parentId, order: data.order },
  });
}

export async function deleteTopic(id: string) {
  const existing = await getPrisma().topic.findFirst({ where: { id } });
  if (!existing) throw AppError.notFound('Topic not found');
  await getPrisma().topic.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapUnique(err: unknown, message: string): AppError {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return AppError.conflict(message);
  }
  return err instanceof AppError ? err : AppError.internal('Database error', err);
}
