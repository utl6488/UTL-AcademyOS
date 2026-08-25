import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { parseApiResponse, parseApiArrayResponse } from "@/lib/api-response";
import {
  studentResultSchema,
  leaderboardEntrySchema,
  classReportSchema,
  instituteDashboardSchema,
  myAttemptSchema,
  type StudentResult,
  type LeaderboardEntry,
  type ClassReport,
  type InstituteDashboard,
  type MyAttempt,
} from "../schemas/results-schemas";
import type { PaginatedResponse } from "@/types";

export function useMyAttempts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.attempts.mine(),
    queryFn: async () => {
      const data = await api.get<MyAttempt[]>("/attempts/mine");
      return parseApiArrayResponse(myAttemptSchema, data);
    },
    enabled: options?.enabled ?? true,
  });
}

export function useStudentResult(attemptId: string) {
  return useQuery({
    queryKey: qk.results.student(attemptId),
    queryFn: async () => {
      const data = await api.get<StudentResult>(`/results/attempts/${attemptId}`);
      return parseApiResponse(studentResultSchema, data);
    },
    enabled: !!attemptId,
  });
}

export function useLeaderboard(examId: string, filters?: { scope?: string; page?: number }) {
  return useQuery({
    queryKey: qk.results.leaderboard(examId, filters),
    queryFn: async () => {
      const data = await api.get<PaginatedResponse<LeaderboardEntry>>(
        `/results/exams/${examId}/leaderboard`,
        filters
      );
      return {
        ...data,
        data: parseApiArrayResponse(leaderboardEntrySchema, data.data),
      };
    },
    enabled: !!examId,
  });
}

export function useClassReport(examId: string) {
  return useQuery({
    queryKey: qk.results.classReport(examId),
    queryFn: async () => {
      const data = await api.get<ClassReport>(`/results/exams/${examId}/class-report`);
      return parseApiResponse(classReportSchema, data);
    },
    enabled: !!examId,
  });
}

export function useInstituteDashboard() {
  return useQuery({
    queryKey: qk.analytics.dashboard(),
    queryFn: async () => {
      const data = await api.get<InstituteDashboard>("/analytics/dashboard");
      return parseApiResponse(instituteDashboardSchema, data);
    },
  });
}
