/**
 * Query Key Factory
 *
 * Centralized query key management for TanStack Query.
 * Each feature has a namespace with typed key generators.
 *
 * Usage:
 *   queryKey: qk.exams.list({ status: "draft" })
 *   queryKey: qk.exams.detail(examId)
 *   queryClient.invalidateQueries({ queryKey: qk.exams.all })
 */

export const qk = {
  auth: {
    all: ["auth"] as const,
    me: () => [...qk.auth.all, "me"] as const,
    sessions: () => [...qk.auth.all, "sessions"] as const,
  },

  institute: {
    all: ["institute"] as const,
    profile: () => [...qk.institute.all, "profile"] as const,
    branding: () => [...qk.institute.all, "branding"] as const,
  },

  users: {
    all: ["users"] as const,
    list: (filters?: Record<string, unknown>) => [...qk.users.all, "list", filters] as const,
    detail: (id: string) => [...qk.users.all, "detail", id] as const,
    import: (jobId: string) => [...qk.users.all, "import", jobId] as const,
  },

  org: {
    all: ["org"] as const,
    branches: {
      all: ["org", "branches"] as const,
      list: (filters?: Record<string, unknown>) =>
        [...qk.org.branches.all, "list", filters] as const,
      detail: (id: string) => [...qk.org.branches.all, "detail", id] as const,
    },
    classes: {
      all: ["org", "classes"] as const,
      list: (filters?: Record<string, unknown>) =>
        [...qk.org.classes.all, "list", filters] as const,
      detail: (id: string) => [...qk.org.classes.all, "detail", id] as const,
    },
    batches: {
      all: ["org", "batches"] as const,
      list: (filters?: Record<string, unknown>) =>
        [...qk.org.batches.all, "list", filters] as const,
      detail: (id: string) => [...qk.org.batches.all, "detail", id] as const,
    },
    subjects: {
      all: ["org", "subjects"] as const,
      list: (filters?: Record<string, unknown>) =>
        [...qk.org.subjects.all, "list", filters] as const,
      detail: (id: string) => [...qk.org.subjects.all, "detail", id] as const,
      topics: (subjectId: string) => [...qk.org.subjects.all, "topics", subjectId] as const,
    },
  },

  questions: {
    all: ["questions"] as const,
    list: (filters?: Record<string, unknown>) => [...qk.questions.all, "list", filters] as const,
    detail: (id: string) => [...qk.questions.all, "detail", id] as const,
    versions: (id: string) => [...qk.questions.all, "versions", id] as const,
  },

  exams: {
    all: ["exams"] as const,
    list: (filters?: Record<string, unknown>) => [...qk.exams.all, "list", filters] as const,
    detail: (id: string) => [...qk.exams.all, "detail", id] as const,
    attempts: (examId: string) => [...qk.exams.all, "attempts", examId] as const,
    liveConsole: (examId: string) => [...qk.exams.all, "live-console", examId] as const,
  },

  attempts: {
    all: ["attempts"] as const,
    detail: (id: string) => [...qk.attempts.all, "detail", id] as const,
    answers: (attemptId: string) => [...qk.attempts.all, "answers", attemptId] as const,
    mine: () => [...qk.attempts.all, "mine"] as const,
  },

  grading: {
    all: ["grading"] as const,
    queue: (filters?: Record<string, unknown>) => [...qk.grading.all, "queue", filters] as const,
    attempt: (attemptId: string) => [...qk.grading.all, "attempt", attemptId] as const,
  },

  results: {
    all: ["results"] as const,
    student: (attemptId: string) => [...qk.results.all, "student", attemptId] as const,
    leaderboard: (examId: string, filters?: Record<string, unknown>) =>
      [...qk.results.all, "leaderboard", examId, filters] as const,
    classReport: (examId: string) => [...qk.results.all, "class-report", examId] as const,
  },

  analytics: {
    all: ["analytics"] as const,
    dashboard: () => [...qk.analytics.all, "dashboard"] as const,
    student: (studentId: string) => [...qk.analytics.all, "student", studentId] as const,
    class: (classId: string) => [...qk.analytics.all, "class", classId] as const,
    batchTrends: (batchId: string, filters?: Record<string, unknown>) =>
      [...qk.analytics.all, "batch-trends", batchId, filters] as const,
  },

  ai: {
    all: ["ai"] as const,
    studyPlan: (studentId: string) => [...qk.ai.all, "study-plan", studentId] as const,
    weakTopics: (studentId: string) => [...qk.ai.all, "weak-topics", studentId] as const,
    predictions: (studentId: string) => [...qk.ai.all, "predictions", studentId] as const,
    classSummary: (examId: string) => [...qk.ai.all, "class-summary", examId] as const,
    homework: (filters: Record<string, unknown>) => [...qk.ai.all, "homework", filters] as const,
  },

  billing: {
    all: ["billing"] as const,
    subscription: () => [...qk.billing.all, "subscription"] as const,
    invoices: () => [...qk.billing.all, "invoices"] as const,
    usage: () => [...qk.billing.all, "usage"] as const,
    plans: () => [...qk.billing.all, "plans"] as const,
  },

  notifications: {
    all: ["notifications"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.notifications.all, "list", filters] as const,
    unreadCount: () => [...qk.notifications.all, "unread-count"] as const,
    preferences: () => [...qk.notifications.all, "preferences"] as const,
  },

  admin: {
    all: ["admin"] as const,
    tenants: {
      all: ["admin", "tenants"] as const,
      list: (filters?: Record<string, unknown>) =>
        [...qk.admin.tenants.all, "list", filters] as const,
      detail: (id: string) => [...qk.admin.tenants.all, "detail", id] as const,
    },
    revenue: () => [...qk.admin.all, "revenue"] as const,
    featureFlags: () => [...qk.admin.all, "feature-flags"] as const,
    health: () => [...qk.admin.all, "health"] as const,
  },
} as const;
