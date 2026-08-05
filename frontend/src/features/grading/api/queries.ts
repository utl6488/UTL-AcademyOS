import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { parseApiArrayResponse, parseApiResponse } from "@/lib/api-response";
import {
  gradingQueueItemSchema,
  gradingAttemptSchema,
  type GradingQueueItem,
  type GradingAttempt,
} from "../schemas/grading-schemas";

export function useGradingQueue() {
  return useQuery({
    queryKey: qk.grading.queue(),
    queryFn: async () => {
      const data = await api.get<GradingQueueItem[]>("/grading/queue");
      return parseApiArrayResponse(gradingQueueItemSchema, data);
    },
  });
}

export function useGradingAttempt(attemptId: string) {
  return useQuery({
    queryKey: qk.grading.attempt(attemptId),
    queryFn: async () => {
      const data = await api.get<GradingAttempt>(`/grading/attempts/${attemptId}`);
      return parseApiResponse(gradingAttemptSchema, data);
    },
    enabled: !!attemptId,
  });
}

export function useGradingAttemptList(examId: string) {
  return useQuery({
    queryKey: [...qk.grading.all, "attempts", examId] as const,
    queryFn: async () => {
      return api.get<{ attemptId: string; studentName: string; isGraded: boolean }[]>(
        `/grading/exams/${examId}/attempts`
      );
    },
    enabled: !!examId,
  });
}
