import { z } from "zod";

// ─── Weak Topic ─────────────────────────────────────────────────────────────

export const weakTopicSchema = z.object({
  topic: z.string(),
  accuracy: z.number(),
  questionsAttempted: z.number(),
  trend: z.enum(["improving", "declining", "stable"]),
});

export type WeakTopic = z.infer<typeof weakTopicSchema>;

// ─── Study Plan ─────────────────────────────────────────────────────────────

export const studyPlanSchema = z.object({
  id: z.string(),
  week: z.number(),
  topics: z.array(z.string()),
  tasks: z.array(z.string()),
  createdAt: z.string(),
});

export type StudyPlan = z.infer<typeof studyPlanSchema>;

// ─── Prediction Result ──────────────────────────────────────────────────────

export const predictionResultSchema = z.object({
  predictedScore: z.number(),
  readinessPercent: z.number(),
  confidence: z.number(),
  factors: z.array(z.string()),
});

export type PredictionResult = z.infer<typeof predictionResultSchema>;

// ─── Generated Question (same shape as QuestionFormValues) ──────────────────

export const generatedQuestionSchema = z.object({
  type: z.string(),
  subjectId: z.string(),
  topicId: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  marks: z.number(),
  tags: z.array(z.string()),
  text: z.string(),
  explanation: z.string().optional(),
  options: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        isCorrect: z.boolean(),
      })
    )
    .optional(),
  correctAnswer: z.union([z.string(), z.array(z.string()), z.boolean(), z.number()]).optional(),
  blanks: z.array(z.string()).optional(),
  tolerance: z.number().optional(),
  unit: z.string().optional(),
  modelAnswer: z.string().optional(),
  rubric: z.string().optional(),
  imageUrl: z.string().optional(),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

// ─── AI Feedback ────────────────────────────────────────────────────────────

export const aiFeedbackSchema = z.object({
  outputId: z.string(),
  thumbsUp: z.boolean(),
});

export type AiFeedback = z.infer<typeof aiFeedbackSchema>;

// ─── Generate Questions Request ─────────────────────────────────────────────

export const generateQuestionsRequestSchema = z.object({
  topic: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  type: z.string(),
  count: z.coerce.number().min(1).max(20),
});

export type GenerateQuestionsRequest = z.infer<typeof generateQuestionsRequestSchema>;

// ─── Generate Exam Request ──────────────────────────────────────────────────

export const generateExamRequestSchema = z.object({
  blueprintId: z.string().optional(),
  subjectId: z.string(),
  totalMarks: z.number(),
  duration: z.number(),
  difficultyDistribution: z.object({
    easy: z.number(),
    medium: z.number(),
    hard: z.number(),
  }),
});

export type GenerateExamRequest = z.infer<typeof generateExamRequestSchema>;

// ─── Class Summary (Teacher AI) ─────────────────────────────────────────────

export const classSummarySchema = z.object({
  headline: z.string(),
  highlights: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  metrics: z.object({
    attemptedStudents: z.number(),
    totalStudents: z.number(),
    averageScore: z.number(),
    passRate: z.number(),
    weakTopics: z.array(
      z.object({
        topic: z.string(),
        averageAccuracy: z.number(),
      })
    ),
  }),
  outputId: z.string().optional(),
});

export type ClassSummary = z.infer<typeof classSummarySchema>;

// ─── Homework Recommendation (Teacher AI) ───────────────────────────────────

export const homeworkRecommendationSchema = z.object({
  cohortSize: z.number(),
  topWeakTopics: z.array(
    z.object({
      topic: z.string(),
      affectedStudents: z.number(),
      averageAccuracy: z.number(),
    })
  ),
  questions: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      difficulty: z.string(),
      topic: z.string().nullable(),
      marks: z.number(),
      reason: z.string(),
    })
  ),
});

export type HomeworkRecommendation = z.infer<typeof homeworkRecommendationSchema>;

// ─── Batch Trends (Institute AI) ────────────────────────────────────────────

export const batchTrendsSchema = z.object({
  batchId: z.string(),
  batchName: z.string(),
  memberCount: z.number(),
  exams: z.array(
    z.object({
      examId: z.string(),
      examTitle: z.string(),
      date: z.string(),
      averageScore: z.number(),
      averageAccuracy: z.number(),
      participation: z.number(),
      passed: z.number(),
      attempted: z.number(),
    })
  ),
  averageAccuracyTrend: z.enum(["improving", "declining", "stable"]),
  weakTopics: z.array(
    z.object({
      topic: z.string(),
      averageAccuracy: z.number(),
      questionCount: z.number(),
    })
  ),
});

export type BatchTrends = z.infer<typeof batchTrendsSchema>;
