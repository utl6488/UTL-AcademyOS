import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { parseApiResponse } from "@/lib/api-response";
import { attemptInfoSchema, type AttemptInfo, type Answer } from "../schemas/attempt-schemas";

export function useAttemptInfo(attemptId: string) {
  return useQuery({
    queryKey: qk.attempts.detail(attemptId),
    queryFn: async () => {
      const data = await api.get<AttemptInfo>(`/attempts/${attemptId}`);
      return parseApiResponse(attemptInfoSchema, data);
    },
    enabled: !!attemptId,
  });
}

export function useAttemptAnswers(attemptId: string) {
  return useQuery({
    queryKey: qk.attempts.answers(attemptId),
    queryFn: async () => {
      return api.get<Answer[]>(`/attempts/${attemptId}/answers`);
    },
    enabled: !!attemptId,
  });
}
