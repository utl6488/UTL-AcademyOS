import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import type { GradeInput } from "../schemas/grading-schemas";

export function useGradeQuestionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, ...data }: GradeInput & { attemptId: string }) =>
      api.post(`/grading/attempts/${attemptId}/grade`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.grading.attempt(variables.attemptId) });
    },
  });
}

export function useSubmitGradesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, grades }: { attemptId: string; grades: GradeInput[] }) =>
      api.post(`/grading/attempts/${attemptId}/submit-grades`, { grades }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.grading.all });
      toast.success("Grades saved");
    },
  });
}

export function useReleaseResultsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) => api.post(`/grading/exams/${examId}/release`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.grading.all });
      toast.success("Results released to students");
    },
  });
}

export function useUnreleaseResultsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) => api.post(`/grading/exams/${examId}/unrelease`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.grading.all });
      toast.success("Results hidden from students");
    },
  });
}
