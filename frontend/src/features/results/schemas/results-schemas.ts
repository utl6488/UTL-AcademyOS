import { z } from "zod";

export const studentResultSchema = z.object({
  attemptId: z.string(),
  examId: z.string(),
  examTitle: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  score: z.number(),
  totalMarks: z.number(),
  percentage: z.number(),
  rank: z.number(),
  totalStudents: z.number(),
  percentile: z.number(),
  submittedAt: z.string(),
  timeTakenMinutes: z.number(),
  sections: z.array(
    z.object({
      title: z.string(),
      score: z.number(),
      totalMarks: z.number(),
      percentage: z.number(),
    })
  ),
  topicAccuracy: z.array(
    z.object({
      topic: z.string(),
      correct: z.number(),
      total: z.number(),
      accuracy: z.number(),
    })
  ),
  timePerQuestion: z.array(
    z.object({
      questionNumber: z.number(),
      seconds: z.number(),
    })
  ),
  questions: z.array(
    z.object({
      questionId: z.string(),
      questionText: z.string(),
      questionType: z.string(),
      studentAnswer: z.unknown(),
      correctAnswer: z.unknown(),
      explanation: z.string().nullable(),
      marks: z.number(),
      scoredMarks: z.number(),
      isCorrect: z.boolean(),
    })
  ),
});

export type StudentResult = z.infer<typeof studentResultSchema>;

export const leaderboardEntrySchema = z.object({
  rank: z.number(),
  studentId: z.string(),
  studentName: z.string(),
  studentAvatar: z.string().nullable(),
  score: z.number(),
  totalMarks: z.number(),
  percentage: z.number(),
  timeTakenMinutes: z.number(),
  isCurrentUser: z.boolean(),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const classReportSchema = z.object({
  examId: z.string(),
  examTitle: z.string(),
  totalStudents: z.number(),
  attemptedStudents: z.number(),
  averageScore: z.number(),
  highestScore: z.number(),
  lowestScore: z.number(),
  passRate: z.number(),
  scoreDistribution: z.array(
    z.object({
      range: z.string(),
      count: z.number(),
    })
  ),
  toppers: z.array(
    z.object({
      rank: z.number(),
      studentName: z.string(),
      score: z.number(),
      percentage: z.number(),
    })
  ),
  weakTopics: z.array(
    z.object({
      topic: z.string(),
      averageAccuracy: z.number(),
      studentCount: z.number(),
    })
  ),
  completionFunnel: z.object({
    assigned: z.number(),
    started: z.number(),
    completed: z.number(),
    passed: z.number(),
  }),
});

export type ClassReport = z.infer<typeof classReportSchema>;

export const instituteDashboardSchema = z.object({
  examsConduted: z.number(),
  averageScore: z.number(),
  activeStudents: z.number(),
  atRiskCount: z.number(),
  recentExams: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      date: z.string(),
      avgScore: z.number(),
      students: z.number(),
    })
  ),
});

export type InstituteDashboard = z.infer<typeof instituteDashboardSchema>;
