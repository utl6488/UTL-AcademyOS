import { z } from "zod";

// ─── Exam Status ────────────────────────────────────────────────────────────

export const ExamStatus = z.enum(["draft", "scheduled", "live", "completed", "cancelled"]);
export type ExamStatus = z.infer<typeof ExamStatus>;

export const ExamMode = z.enum(["FLEXIBLE", "SYNCHRONOUS"]);
export type ExamMode = z.infer<typeof ExamMode>;

// ─── Proctoring Config ──────────────────────────────────────────────────────

export const fullscreenPolicy = z.enum(["flag_only", "warn_then_submit", "auto_submit"]);
export const tabSwitchPolicy = z.enum(["flag_only", "warn_then_submit", "auto_submit"]);

export const proctoringConfigSchema = z.object({
  requireFullscreen: z.boolean().default(true),
  fullscreenExitPolicy: fullscreenPolicy.default("warn_then_submit"),
  fullscreenMaxWarnings: z.number().min(1).max(10).default(3),
  tabSwitchPolicy: tabSwitchPolicy.default("warn_then_submit"),
  tabSwitchMaxWarnings: z.number().min(1).max(10).default(3),
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
});

export type ProctoringConfig = z.infer<typeof proctoringConfigSchema>;

// ─── Exam Section ───────────────────────────────────────────────────────────

export const examSectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Section title is required"),
  durationMinutes: z.number().min(1).nullable(),
  questions: z.array(
    z.object({
      questionId: z.string(),
      questionText: z.string().optional(),
      questionType: z.string().optional(),
      marks: z.number().min(0),
      order: z.number(),
    })
  ),
});

export type ExamSection = z.infer<typeof examSectionSchema>;

// ─── Exam List Item ─────────────────────────────────────────────────────────

export const examListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: ExamStatus,
  mode: ExamMode,
  totalMarks: z.number(),
  durationMinutes: z.number(),
  questionsCount: z.number(),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  activeAttempts: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ExamListItem = z.infer<typeof examListItemSchema>;

// ─── Exam Detail ────────────────────────────────────────────────────────────

export const examDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  instructions: z.string().nullable(),
  status: ExamStatus,
  mode: ExamMode,
  durationMinutes: z.number(),
  totalMarks: z.number(),
  negativeMarking: z.number().default(0),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  lateEntryGraceMs: z.number().default(0),
  lockdownOnLate: z.boolean().default(false),
  assignedClasses: z.array(z.string()),
  assignedBatches: z.array(z.string()),
  assignedStudents: z.array(z.string()),
  sections: z.array(examSectionSchema),
  proctoring: proctoringConfigSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ExamDetail = z.infer<typeof examDetailSchema>;

// ─── Exam Form (Builder Wizard) ─────────────────────────────────────────────

export const examDetailsStepSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  instructions: z.string().optional(),
  durationMinutes: z.coerce.number().min(1, "Duration must be at least 1 minute"),
  totalMarks: z.coerce.number().min(1, "Total marks must be at least 1"),
  negativeMarking: z.coerce.number().min(0).max(100).default(0),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
});

export type ExamDetailsStepValues = z.infer<typeof examDetailsStepSchema>;

export const examScheduleStepSchema = z.object({
  mode: ExamMode,
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  lateEntryGraceMs: z.coerce.number().default(0),
  lockdownOnLate: z.boolean().default(false),
  assignedClasses: z.array(z.string()).default([]),
  assignedBatches: z.array(z.string()).default([]),
  assignedStudents: z.array(z.string()).default([]),
});

export type ExamScheduleStepValues = z.infer<typeof examScheduleStepSchema>;

// ─── Live Console Types ─────────────────────────────────────────────────────

export const liveAttemptSchema = z.object({
  attemptId: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  status: z.enum(["in_progress", "submitted", "locked_out"]),
  startedAt: z.string(),
  violationCount: z.number(),
  riskScore: z.number(),
  lastEvent: z.string().nullable(),
});

export type LiveAttempt = z.infer<typeof liveAttemptSchema>;
