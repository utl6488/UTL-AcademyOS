import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Answer, ProctoringEvent } from "../schemas/attempt-schemas";

export function useStartAttemptMutation() {
  return useMutation({
    mutationFn: (examId: string) =>
      api.post<{ attemptId: string; status: string }>(`/exams/${examId}/start`),
  });
}

export function useReserveAttemptMutation() {
  return useMutation({
    mutationFn: (examId: string) =>
      api.post<{ attemptId: string }>(`/attempts/reserve`, { examId }),
  });
}

export function useSaveAnswerMutation() {
  return useMutation({
    mutationFn: ({ attemptId, ...answer }: { attemptId: string } & Answer) =>
      api.post(`/attempts/${attemptId}/answers`, answer),
  });
}

export function useSaveAnswersBatchMutation() {
  return useMutation({
    mutationFn: ({ attemptId, answers }: { attemptId: string; answers: Answer[] }) =>
      api.post(`/attempts/${attemptId}/answers/batch`, { answers }),
  });
}

export function useSubmitAttemptMutation() {
  return useMutation({
    mutationFn: (attemptId: string) =>
      api.post<{ status: string; score?: number }>(`/attempts/${attemptId}/submit`),
  });
}

export function useSendProctoringEventsMutation() {
  return useMutation({
    mutationFn: ({ attemptId, events }: { attemptId: string; events: ProctoringEvent[] }) =>
      api.post(`/attempts/${attemptId}/proctoring-events`, { events }),
  });
}

export function useGetLaunchTokenMutation() {
  return useMutation({
    mutationFn: (attemptId: string) =>
      api.post<{ launchToken: string; deepLink: string }>(`/attempts/${attemptId}/launch-token`),
  });
}
