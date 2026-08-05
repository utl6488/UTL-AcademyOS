import { z } from "zod";

export const AttemptStatus = z.enum([
  "NOT_STARTED",
  "LOBBY",
  "IN_PROGRESS",
  "SUBMITTED",
  "AUTO_SUBMITTED",
  "LOCKED_OUT",
]);
export type AttemptStatus = z.infer<typeof AttemptStatus>;

export const QuestionStatus = z.enum(["unanswered", "answered", "marked", "marked_answered"]);
export type QuestionStatus = z.infer<typeof QuestionStatus>;

export const attemptInfoSchema = z.object({
  id: z.string(),
  examId: z.string(),
  examTitle: z.string(),
  status: AttemptStatus,
  mode: z.enum(["FLEXIBLE", "SYNCHRONOUS"]),
  startedAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  startAt: z.string().nullable(), // exam scheduled start (SYNCHRONOUS)
  durationMinutes: z.number(),
  totalMarks: z.number(),
  lateEntryGraceMs: z.number(),
  lockdownOnLate: z.boolean(),
  instructions: z.string().nullable(),
  requireSecureBrowser: z.boolean(),
  attestedBy: z.enum(["WEB", "SECURE_BROWSER"]).nullable(),
  proctoring: z.object({
    requireFullscreen: z.boolean(),
    fullscreenExitPolicy: z.enum(["flag_only", "warn_then_submit", "auto_submit"]),
    fullscreenMaxWarnings: z.number(),
    tabSwitchPolicy: z.enum(["flag_only", "warn_then_submit", "auto_submit"]),
    tabSwitchMaxWarnings: z.number(),
    disableCopy: z.boolean(),
    disablePaste: z.boolean(),
    disableRightClick: z.boolean(),
    disablePrint: z.boolean(),
    disableDevtools: z.boolean(),
    blockMultipleDisplays: z.boolean(),
  }),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      questions: z.array(
        z.object({
          id: z.string(),
          questionId: z.string(),
          text: z.string(),
          type: z.string(),
          marks: z.number(),
          options: z.array(z.object({ id: z.string(), text: z.string() })).nullable(),
          imageUrl: z.string().nullable(),
          blanksCount: z.number().nullable(),
          unit: z.string().nullable(),
        })
      ),
    })
  ),
});

export type AttemptInfo = z.infer<typeof attemptInfoSchema>;

export const answerSchema = z.object({
  questionId: z.string(),
  answer: z.unknown(), // string | string[] | number | boolean | null
  isMarked: z.boolean().default(false),
  answeredAt: z.string().nullable(),
});

export type Answer = z.infer<typeof answerSchema>;

// Proctoring event types
export const ProctoringEventType = z.enum([
  "FULLSCREEN_EXIT",
  "FULLSCREEN_ENTER",
  "TAB_HIDDEN",
  "TAB_VISIBLE",
  "WINDOW_BLUR",
  "WINDOW_FOCUS",
  "RIGHT_CLICK",
  "COPY",
  "PASTE",
  "PRINT_ATTEMPT",
  "DEVTOOLS_SUSPECTED",
  "SECOND_DISPLAY_DETECTED",
]);

export type ProctoringEventType = z.infer<typeof ProctoringEventType>;

export interface ProctoringEvent {
  clientEventId: string;
  type: ProctoringEventType;
  timestamp: number;
  meta?: Record<string, unknown>;
}
