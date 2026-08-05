import { z } from 'zod';

// API status is lowercase (matches frontend); DB enum is uppercase.
export const ApiExamStatus = z.enum(['draft', 'scheduled', 'live', 'completed', 'cancelled']);
export type ApiExamStatus = z.infer<typeof ApiExamStatus>;

export const ApiExamMode = z.enum(['FLEXIBLE', 'SYNCHRONOUS']);
export type ApiExamMode = z.infer<typeof ApiExamMode>;

// Proctoring config — mirrors frontend features/exam-authoring/schemas.
// Kept loose (`passthrough`) so future frontend fields land without a backend
// schema bump. Type-specific validation lives in the frontend form; server
// only needs to persist and echo it back.
export const ProctoringConfigSchema = z
  .object({
    requireFullscreen: z.boolean().default(true),
    fullscreenExitPolicy: z
      .enum(['flag_only', 'warn_then_submit', 'auto_submit'])
      .default('warn_then_submit'),
    fullscreenMaxWarnings: z.number().int().min(1).max(10).default(3),
    tabSwitchPolicy: z
      .enum(['flag_only', 'warn_then_submit', 'auto_submit'])
      .default('warn_then_submit'),
    tabSwitchMaxWarnings: z.number().int().min(1).max(10).default(3),
    disableCopy: z.boolean().default(true),
    disablePaste: z.boolean().default(true),
    disableRightClick: z.boolean().default(true),
    disablePrint: z.boolean().default(true),
    disableDevtools: z.boolean().default(true),
    blockMultipleDisplays: z.boolean().default(false),
    requireSecureBrowser: z.boolean().default(false),
    blockVMs: z.boolean().default(false),
    forbiddenProcesses: z.array(z.string()).default([]),
    snapshotEveryMs: z.number().nullable().default(null),
    webcamProctoring: z.boolean().default(false),
  })
  .passthrough();
export type ProctoringConfig = z.infer<typeof ProctoringConfigSchema>;

export const ExamSectionQuestionSchema = z.object({
  questionId: z.string().min(1),
  marks: z.number().min(0),
  order: z.number().int().min(0),
});

export const ExamSectionInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Section title is required').max(200),
  durationMinutes: z.number().int().min(1).nullable().optional(),
  questions: z.array(ExamSectionQuestionSchema).default([]),
});
export type ExamSectionInput = z.infer<typeof ExamSectionInputSchema>;

// ISO datetime strings from the frontend wizard; server coerces to Date.
const ExamScheduleFields = z.object({
  mode: ApiExamMode.default('FLEXIBLE'),
  startAt: z.string().datetime({ offset: true }).optional().nullable(),
  endAt: z.string().datetime({ offset: true }).optional().nullable(),
  lateEntryGraceMs: z.number().int().min(0).default(0),
  lockdownOnLate: z.boolean().default(false),
  assignedClasses: z.array(z.string()).default([]),
  assignedBatches: z.array(z.string()).default([]),
  assignedStudents: z.array(z.string()).default([]),
});

export const ExamCreateSchema = z
  .object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(200),
    instructions: z.string().optional().nullable(),
    durationMinutes: z.coerce.number().int().min(1),
    totalMarks: z.coerce.number().min(1),
    negativeMarking: z.coerce.number().min(0).max(100).default(0),
    shuffleQuestions: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    sections: z.array(ExamSectionInputSchema).default([]),
    proctoring: ProctoringConfigSchema.default({}),
  })
  .merge(ExamScheduleFields);
export type ExamCreateInput = z.infer<typeof ExamCreateSchema>;

// Update = partial of create. Sections replace-in-full when present.
export const ExamUpdateSchema = ExamCreateSchema.partial();
export type ExamUpdateInput = z.infer<typeof ExamUpdateSchema>;

export const ExamListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: ApiExamStatus.optional(),
  mode: ApiExamMode.optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'startAt', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ExamListQuery = z.infer<typeof ExamListQuerySchema>;

export const SendWarningSchema = z.object({
  message: z.string().min(1).max(500),
});
