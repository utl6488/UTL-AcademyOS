import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { parseApiResponse } from "@/lib/api-response";
import {
  batchTrendsSchema,
  classSummarySchema,
  homeworkRecommendationSchema,
  type BatchTrends,
  type ClassSummary,
  type HomeworkRecommendation,
  type PredictionResult,
  type StudyPlan,
  type WeakTopic,
} from "../schemas/ai-schemas";

export function useWeakTopics(studentId: string) {
  return useQuery({
    queryKey: qk.ai.weakTopics(studentId),
    queryFn: () => api.get<WeakTopic[]>(`/ai/students/${studentId}/weak-topics`),
    enabled: !!studentId,
  });
}

export function useStudyPlan(studentId: string) {
  return useQuery({
    queryKey: qk.ai.studyPlan(studentId),
    queryFn: () => api.get<StudyPlan | null>(`/ai/students/${studentId}/study-plan`),
    enabled: !!studentId,
  });
}

export function usePredictions(studentId: string) {
  return useQuery({
    queryKey: qk.ai.predictions(studentId),
    queryFn: () => api.get<PredictionResult>(`/ai/students/${studentId}/predictions`),
    enabled: !!studentId,
  });
}

export function useClassSummary(examId: string | undefined) {
  return useQuery({
    queryKey: qk.ai.classSummary(examId ?? ""),
    queryFn: async () => {
      const data = await api.get<ClassSummary>(`/ai/exams/${examId}/class-summary`);
      return parseApiResponse(classSummarySchema, data);
    },
    enabled: !!examId,
  });
}

export interface HomeworkRecommendationParams {
  classId?: string;
  batchId?: string;
  subjectId?: string;
  count?: number;
  [key: string]: string | number | boolean | string[] | undefined;
}

export function useHomeworkRecommendation(
  params: HomeworkRecommendationParams,
  opts: { enabled?: boolean } = {}
) {
  const enabled = (opts.enabled ?? true) && Boolean(params.classId ?? params.batchId);
  return useQuery({
    queryKey: qk.ai.homework(params as Record<string, unknown>),
    queryFn: async () => {
      const data = await api.get<HomeworkRecommendation>("/ai/homework/recommend", params);
      return parseApiResponse(homeworkRecommendationSchema, data);
    },
    enabled,
  });
}

export function useBatchTrends(batchId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: qk.analytics.batchTrends(batchId ?? "", { limit }),
    queryFn: async () => {
      const data = await api.get<BatchTrends>(
        `/analytics/batches/${batchId}/trends`,
        limit ? { limit } : undefined
      );
      return parseApiResponse(batchTrendsSchema, data);
    },
    enabled: !!batchId,
  });
}
