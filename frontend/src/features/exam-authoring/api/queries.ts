import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { parseApiResponse, parseApiArrayResponse } from "@/lib/api-response";
import {
  examDetailSchema,
  examListItemSchema,
  liveAttemptSchema,
  type ExamListItem,
  type ExamDetail,
  type ExamStatus,
  type LiveAttempt,
} from "../schemas/exam-schemas";
import type { PaginatedResponse, PaginationParams } from "@/types";

export interface ExamFilters extends PaginationParams {
  status?: ExamStatus;
}

export function useExams(filters: ExamFilters) {
  return useQuery({
    queryKey: qk.exams.list(filters),
    queryFn: async () => {
      const data = await api.get<PaginatedResponse<ExamListItem>>("/exams", filters);
      return {
        ...data,
        data: parseApiArrayResponse(examListItemSchema, data.data),
      };
    },
  });
}

export function useExamDetail(id: string) {
  return useQuery({
    queryKey: qk.exams.detail(id),
    queryFn: async () => {
      const data = await api.get<ExamDetail>(`/exams/${id}`);
      return parseApiResponse(examDetailSchema, data);
    },
    enabled: !!id,
  });
}

export function useLiveConsole(examId: string) {
  return useQuery({
    queryKey: qk.exams.liveConsole(examId),
    queryFn: async () => {
      const data = await api.get<LiveAttempt[]>(`/exams/${examId}/live-console`);
      return parseApiArrayResponse(liveAttemptSchema, data);
    },
    enabled: !!examId,
    refetchInterval: 5000, // Poll every 5s, socket will supplement
  });
}
