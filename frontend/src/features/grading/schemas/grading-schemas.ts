import { z } from "zod";

export const gradingQueueItemSchema = z.object({
  examId: z.string(),
  examTitle: z.string(),
  pendingCount: z.number(),
  totalCount: z.number(),
  gradedCount: z.number(),
  released: z.boolean(),
  dueDate: z.string().nullable(),
});

export type GradingQueueItem = z.infer<typeof gradingQueueItemSchema>;

export const gradingAttemptSchema = z.object({
  attemptId: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  studentAvatar: z.string().nullable(),
  submittedAt: z.string(),
  totalMarks: z.number(),
  scoredMarks: z.number().nullable(),
  isGraded: z.boolean(),
  questions: z.array(
    z.object({
      questionId: z.string(),
      questionText: z.string(),
      questionType: z.string(),
      maxMarks: z.number(),
      studentAnswer: z.unknown(),
      modelAnswer: z.unknown().nullable(),
      rubric: z.string().nullable(),
      scoredMarks: z.number().nullable(),
      feedback: z.string().nullable(),
      isAutoGraded: z.boolean(),
    })
  ),
});

export type GradingAttempt = z.infer<typeof gradingAttemptSchema>;

export const gradeInputSchema = z.object({
  questionId: z.string(),
  marks: z.coerce.number().min(0),
  feedback: z.string().optional(),
});

export type GradeInput = z.infer<typeof gradeInputSchema>;
