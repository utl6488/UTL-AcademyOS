import { z } from 'zod';

// API-side difficulty is lowercase (matches the frontend); the Prisma enum is
// uppercase. Translated by the service layer.
export const ApiDifficulty = z.enum(['easy', 'medium', 'hard']);
export type ApiDifficulty = z.infer<typeof ApiDifficulty>;

export const ApiQuestionType = z.enum([
  'MCQ',
  'MSQ',
  'TRUE_FALSE',
  'FILL_BLANK',
  'NUMERICAL',
  'SHORT_ANSWER',
  'LONG_ANSWER',
  'IMAGE_BASED',
]);
export type ApiQuestionType = z.infer<typeof ApiQuestionType>;

export const McqOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1, 'Option text is required'),
  isCorrect: z.boolean(),
});
export type McqOption = z.infer<typeof McqOptionSchema>;

const baseFields = z.object({
  subjectId: z.string().min(1, 'Subject is required'),
  topicId: z.string().optional().nullable(),
  difficulty: ApiDifficulty,
  marks: z.coerce.number().min(0.5, 'Marks must be at least 0.5'),
  negativeMarks: z.coerce.number().min(0).default(0),
  tags: z.array(z.string()).default([]),
  text: z.string().min(1, 'Question text is required'),
  explanation: z.string().optional().nullable(),
});

export const McqFormSchema = baseFields.extend({
  type: z.literal('MCQ'),
  options: z
    .array(McqOptionSchema)
    .min(2, 'At least 2 options are required')
    .refine((opts) => opts.filter((o) => o.isCorrect).length === 1, {
      message: 'MCQ must have exactly one correct option',
    }),
});

export const MsqFormSchema = baseFields.extend({
  type: z.literal('MSQ'),
  options: z
    .array(McqOptionSchema)
    .min(2, 'At least 2 options are required')
    .refine((opts) => opts.some((o) => o.isCorrect), {
      message: 'MSQ must have at least one correct option',
    }),
});

export const TrueFalseFormSchema = baseFields.extend({
  type: z.literal('TRUE_FALSE'),
  correctAnswer: z.boolean(),
});

export const FillBlankFormSchema = baseFields.extend({
  type: z.literal('FILL_BLANK'),
  blanks: z
    .array(z.string().min(1, 'Blank answer is required'))
    .min(1, 'At least one blank is required'),
});

export const NumericalFormSchema = baseFields.extend({
  type: z.literal('NUMERICAL'),
  correctAnswer: z.coerce.number(),
  tolerance: z.coerce.number().min(0).default(0),
  unit: z.string().optional().nullable(),
});

export const ShortAnswerFormSchema = baseFields.extend({
  type: z.literal('SHORT_ANSWER'),
  modelAnswer: z.string().min(1, 'Model answer is required'),
  rubric: z.string().optional().nullable(),
});

export const LongAnswerFormSchema = baseFields.extend({
  type: z.literal('LONG_ANSWER'),
  modelAnswer: z.string().min(1, 'Model answer is required'),
  rubric: z.string().optional().nullable(),
});

export const ImageBasedFormSchema = baseFields.extend({
  type: z.literal('IMAGE_BASED'),
  imageUrl: z.string().min(1, 'Image is required'),
  options: z
    .array(McqOptionSchema)
    .min(2, 'At least 2 options are required')
    .refine((opts) => opts.some((o) => o.isCorrect), {
      message: 'IMAGE_BASED must mark at least one correct option',
    }),
});

export const QuestionCreateSchema = z.discriminatedUnion('type', [
  McqFormSchema,
  MsqFormSchema,
  TrueFalseFormSchema,
  FillBlankFormSchema,
  NumericalFormSchema,
  ShortAnswerFormSchema,
  LongAnswerFormSchema,
  ImageBasedFormSchema,
]);
export type QuestionCreateInput = z.infer<typeof QuestionCreateSchema>;

// Updates re-use the same discriminated shape (full replace on update). Partial
// updates would break invariants like "MCQ has exactly one correct option".
export const QuestionUpdateSchema = QuestionCreateSchema;
export type QuestionUpdateInput = z.infer<typeof QuestionUpdateSchema>;

export const QuestionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  subjectId: z.string().optional(),
  topicId: z.string().optional(),
  difficulty: ApiDifficulty.optional(),
  type: ApiQuestionType.optional(),
  tags: z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    )
    .optional(),
  search: z.string().optional(),
  tenantId: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'marks', 'difficulty']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type QuestionListQuery = z.infer<typeof QuestionListQuerySchema>;

export const QuestionImageUploadSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export const QuestionImportUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export const QuestionImportStartSchema = z.object({
  fileKey: z.string().min(1),
});

export const QuestionExportSchema = z
  .object({
    subjectId: z.string().optional(),
    topicId: z.string().optional(),
    type: ApiQuestionType.optional(),
    difficulty: ApiDifficulty.optional(),
  })
  .default({});
