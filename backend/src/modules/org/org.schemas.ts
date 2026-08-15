import { z } from 'zod';

// -------- Branch --------
export const BranchCreateSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});
export const BranchUpdateSchema = BranchCreateSchema.partial();
export type BranchInput = z.infer<typeof BranchCreateSchema>;

// -------- Academic Year --------
export const AcademicYearCreateSchema = z
  .object({
    name: z.string().min(4).max(20),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isCurrent: z.boolean().optional(),
  })
  .refine((v) => v.startDate < v.endDate, {
    message: 'startDate must be before endDate',
    path: ['endDate'],
  });
export const AcademicYearUpdateSchema = z
  .object({
    name: z.string().min(4).max(20).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    isCurrent: z.boolean().optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate < v.endDate, {
    message: 'startDate must be before endDate',
    path: ['endDate'],
  });
export type AcademicYearInput = z.infer<typeof AcademicYearCreateSchema>;

// -------- Class + Sections --------
export const ClassCreateSchema = z.object({
  name: z.string().min(1).max(50),
  numericOrder: z.number().int().min(1).max(20),
  branchId: z.string().optional(),
  sections: z.array(z.string().min(1).max(20)).min(1, 'At least one section is required'),
});
export const ClassUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  numericOrder: z.number().int().min(1).max(20).optional(),
  branchId: z.string().nullable().optional(),
  sections: z.array(z.string().min(1).max(20)).optional(),
});

// -------- Batch --------
export const BatchCreateSchema = z.object({
  name: z.string().min(2).max(100),
  classId: z.string().min(1),
  teacherId: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});
export const BatchUpdateSchema = BatchCreateSchema.partial();

// -------- Subject --------
export const SubjectCreateSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().max(20).optional(),
  // Classes are optional at create time — a subject can be linked to classes later.
  classIds: z.array(z.string()).default([]),
});
export const SubjectUpdateSchema = SubjectCreateSchema.partial();

// -------- Topic --------
export const TopicCreateSchema = z.object({
  name: z.string().min(2).max(100),
  subjectId: z.string().min(1),
  parentId: z.string().optional(),
  order: z.number().int().min(0).max(1000).optional(),
});
export const TopicUpdateSchema = TopicCreateSchema.partial();
