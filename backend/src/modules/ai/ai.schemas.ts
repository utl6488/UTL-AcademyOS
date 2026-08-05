import { z } from 'zod';

export const GenerateQuestionsRequestSchema = z.object({
  topic: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  type: z.enum([
    'MCQ',
    'MSQ',
    'TRUE_FALSE',
    'FILL_BLANK',
    'NUMERICAL',
    'SHORT_ANSWER',
    'LONG_ANSWER',
  ]),
  count: z.coerce.number().int().min(1).max(20),
  subjectId: z.string().optional(),
});
export type GenerateQuestionsInput = z.infer<typeof GenerateQuestionsRequestSchema>;

export const GenerateExamRequestSchema = z.object({
  blueprintId: z.string().optional(),
  subjectId: z.string().min(1),
  totalMarks: z.coerce.number().min(1),
  duration: z.coerce.number().int().min(1),
  difficultyDistribution: z.object({
    easy: z.coerce.number().int().min(0),
    medium: z.coerce.number().int().min(0),
    hard: z.coerce.number().int().min(0),
  }),
});
export type GenerateExamInput = z.infer<typeof GenerateExamRequestSchema>;

export const AiFeedbackSchema = z.object({
  outputId: z.string().min(1),
  thumbsUp: z.boolean(),
});
export type AiFeedbackInput = z.infer<typeof AiFeedbackSchema>;

export const HomeworkRecommendationQuerySchema = z
  .object({
    classId: z.string().optional(),
    batchId: z.string().optional(),
    subjectId: z.string().optional(),
    count: z.coerce.number().int().min(1).max(50).default(10),
  })
  .refine((v) => Boolean(v.classId ?? v.batchId), {
    message: 'classId or batchId is required',
    path: ['classId'],
  });
export type HomeworkRecommendationQuery = z.infer<typeof HomeworkRecommendationQuerySchema>;
