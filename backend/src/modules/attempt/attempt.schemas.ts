import { z } from 'zod';

export const SaveAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.unknown(),
  isMarked: z.boolean().default(false),
  clientRevision: z.number().int().min(0).default(0),
  timeSpentMs: z.number().int().min(0).default(0),
  answeredAt: z.string().optional().nullable(),
});
export type SaveAnswerInput = z.infer<typeof SaveAnswerSchema>;

export const SaveAnswersBatchSchema = z.object({
  answers: z.array(SaveAnswerSchema).max(200),
});

export const ReserveAttemptSchema = z.object({
  examId: z.string().min(1),
});

export const ProctoringEventTypeSchema = z.enum([
  'FULLSCREEN_EXIT',
  'FULLSCREEN_ENTER',
  'TAB_HIDDEN',
  'TAB_VISIBLE',
  'WINDOW_BLUR',
  'WINDOW_FOCUS',
  'COPY',
  'PASTE',
  'RIGHT_CLICK',
  'PRINT_ATTEMPT',
  'DEVTOOLS_SUSPECTED',
  'SECOND_DISPLAY_DETECTED',
]);

export const ProctoringEventSchema = z.object({
  clientEventId: z.string().min(1),
  type: ProctoringEventTypeSchema,
  timestamp: z.number().int(),
  meta: z.record(z.unknown()).optional(),
});

export const ProctoringEventsBatchSchema = z.object({
  events: z.array(ProctoringEventSchema).max(50),
});
export type ProctoringEventsBatchInput = z.infer<typeof ProctoringEventsBatchSchema>;
