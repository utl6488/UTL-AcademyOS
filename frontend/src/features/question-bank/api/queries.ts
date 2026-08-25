import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { parseApiResponse } from "@/lib/api-response";
import {
  questionDetailSchema,
  type QuestionListItem,
  type QuestionDetail,
  type QuestionVersion,
  type QuestionType,
  type Difficulty,
} from "../schemas/question-schemas";
import type { PaginatedResponse, PaginationParams } from "@/types";

export interface QuestionFilters extends PaginationParams {
  subjectId?: string;
  topicId?: string;
  difficulty?: Difficulty;
  type?: QuestionType;
  tags?: string[];
  search?: string;
  tenantId?: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

export function useQuestions(filters: QuestionFilters) {
  return useQuery({
    queryKey: qk.questions.list(filters),
    queryFn: async () => {
      return api.get<PaginatedResponse<QuestionListItem>>("/questions", {
        ...filters,
        tags: filters.tags?.join(","),
      });
    },
  });
}

export function useQuestionDetail(id: string) {
  return useQuery({
    queryKey: qk.questions.detail(id),
    queryFn: async () => {
      const data = await api.get<QuestionDetail>(`/questions/${id}`);
      return parseApiResponse(questionDetailSchema, data);
    },
    enabled: !!id,
  });
}

export function useQuestionVersions(id: string) {
  return useQuery({
    queryKey: qk.questions.versions(id),
    queryFn: async () => {
      return api.get<QuestionVersion[]>(`/questions/${id}/versions`);
    },
    enabled: !!id,
  });
}
