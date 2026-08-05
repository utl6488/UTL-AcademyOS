import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import type {
  GeneratedQuestion,
  GenerateQuestionsRequest,
  GenerateExamRequest,
  AiFeedback,
  StudyPlan,
} from "../schemas/ai-schemas";

export function useGenerateStudyPlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) =>
      api.post<StudyPlan>(`/ai/students/${studentId}/study-plan/generate`),
    onSuccess: (_data, studentId) => {
      queryClient.invalidateQueries({ queryKey: qk.ai.studyPlan(studentId) });
      toast.success("Study plan generated", "A new weekly study plan is ready.");
    },
  });
}

export function useGenerateQuestionsMutation() {
  return useMutation({
    mutationFn: (params: GenerateQuestionsRequest) =>
      api.post<GeneratedQuestion[]>("/ai/questions/generate", params),
    onSuccess: () => {
      toast.success("Questions generated", "Review the generated questions below.");
    },
  });
}

export function useGenerateExamMutation() {
  return useMutation({
    mutationFn: (params: GenerateExamRequest) =>
      api.post<{ examId: string }>("/ai/exams/generate", params),
    onSuccess: () => {
      toast.success("Exam generated", "The exam draft has been created.");
    },
  });
}

export function useSubmitAiFeedbackMutation() {
  return useMutation({
    mutationFn: (feedback: AiFeedback) => api.post("/ai/feedback", feedback),
    onSuccess: () => {
      toast.success("Feedback submitted", "Thanks for helping us improve.");
    },
  });
}
