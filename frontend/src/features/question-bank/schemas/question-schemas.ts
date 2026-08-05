import { z } from "zod";

// ─── Question Type Enum ─────────────────────────────────────────────────────

export const QuestionType = z.enum([
  "MCQ",
  "MSQ",
  "TRUE_FALSE",
  "FILL_BLANK",
  "NUMERICAL",
  "SHORT_ANSWER",
  "LONG_ANSWER",
  "IMAGE_BASED",
]);

export type QuestionType = z.infer<typeof QuestionType>;

export const Difficulty = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof Difficulty>;

// ─── MCQ Option Schema ──────────────────────────────────────────────────────

export const mcqOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1, "Option text is required"),
  isCorrect: z.boolean(),
});

export type McqOption = z.infer<typeof mcqOptionSchema>;

// ─── Question List Item ─────────────────────────────────────────────────────

export const questionListItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: QuestionType,
  subjectId: z.string(),
  subjectName: z.string(),
  topicId: z.string().nullable(),
  topicName: z.string().nullable(),
  difficulty: Difficulty,
  tags: z.array(z.string()),
  marks: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type QuestionListItem = z.infer<typeof questionListItemSchema>;

// ─── Question Detail ────────────────────────────────────────────────────────

export const questionDetailSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: QuestionType,
  subjectId: z.string(),
  subjectName: z.string(),
  topicId: z.string().nullable(),
  topicName: z.string().nullable(),
  difficulty: Difficulty,
  tags: z.array(z.string()),
  marks: z.number(),
  options: z.array(mcqOptionSchema).nullable(),
  correctAnswer: z.union([z.string(), z.array(z.string()), z.boolean()]).nullable(),
  explanation: z.string().nullable(),
  rubric: z.string().nullable(),
  imageUrl: z.string().nullable(),
  tolerance: z.number().nullable(),
  unit: z.string().nullable(),
  blanks: z.array(z.string()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
});

export type QuestionDetail = z.infer<typeof questionDetailSchema>;

// ─── Version Schema ─────────────────────────────────────────────────────────

export const questionVersionSchema = z.object({
  id: z.string(),
  questionId: z.string(),
  version: z.number(),
  changedBy: z.string(),
  changedAt: z.string(),
  diff: z.record(
    z.object({
      old: z.unknown(),
      new: z.unknown(),
    })
  ),
});

export type QuestionVersion = z.infer<typeof questionVersionSchema>;

// ─── Form Values (Polymorphic) ──────────────────────────────────────────────

const baseFormFields = z.object({
  subjectId: z.string().min(1, "Subject is required"),
  topicId: z.string().optional(),
  difficulty: Difficulty,
  marks: z.coerce.number().min(0.5, "Marks must be at least 0.5"),
  tags: z.array(z.string()).default([]),
  text: z.string().min(1, "Question text is required"),
  explanation: z.string().optional(),
});

export const mcqFormSchema = baseFormFields.extend({
  type: z.literal("MCQ"),
  options: z.array(mcqOptionSchema).min(2, "At least 2 options are required"),
});

export const msqFormSchema = baseFormFields.extend({
  type: z.literal("MSQ"),
  options: z.array(mcqOptionSchema).min(2, "At least 2 options are required"),
});

export const trueFalseFormSchema = baseFormFields.extend({
  type: z.literal("TRUE_FALSE"),
  correctAnswer: z.boolean(),
});

export const fillBlankFormSchema = baseFormFields.extend({
  type: z.literal("FILL_BLANK"),
  blanks: z
    .array(z.string().min(1, "Blank answer is required"))
    .min(1, "At least one blank is required"),
});

export const numericalFormSchema = baseFormFields.extend({
  type: z.literal("NUMERICAL"),
  correctAnswer: z.coerce.number(),
  tolerance: z.coerce.number().min(0).default(0),
  unit: z.string().optional(),
});

export const shortAnswerFormSchema = baseFormFields.extend({
  type: z.literal("SHORT_ANSWER"),
  modelAnswer: z.string().min(1, "Model answer is required"),
  rubric: z.string().optional(),
});

export const longAnswerFormSchema = baseFormFields.extend({
  type: z.literal("LONG_ANSWER"),
  modelAnswer: z.string().min(1, "Model answer is required"),
  rubric: z.string().optional(),
});

export const imageBasedFormSchema = baseFormFields.extend({
  type: z.literal("IMAGE_BASED"),
  imageUrl: z.string().min(1, "Image is required"),
  options: z.array(mcqOptionSchema).min(2, "At least 2 options are required"),
});

export const questionFormSchema = z.discriminatedUnion("type", [
  mcqFormSchema,
  msqFormSchema,
  trueFalseFormSchema,
  fillBlankFormSchema,
  numericalFormSchema,
  shortAnswerFormSchema,
  longAnswerFormSchema,
  imageBasedFormSchema,
]);

export type QuestionFormValues = z.infer<typeof questionFormSchema>;
