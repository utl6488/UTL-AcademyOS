import { z } from 'zod';

export const GradeInputSchema = z.object({
  questionId: z.string().min(1),
  marks: z.coerce.number().min(0),
  feedback: z.string().optional(),
});
export type GradeInput = z.infer<typeof GradeInputSchema>;

export const SubmitGradesSchema = z.object({
  grades: z.array(GradeInputSchema).min(1),
});
