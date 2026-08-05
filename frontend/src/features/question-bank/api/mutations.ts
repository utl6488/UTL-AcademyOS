import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiClient } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import type { QuestionFormValues, QuestionDetail } from "../schemas/question-schemas";

export function useCreateQuestionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: QuestionFormValues) => api.post<QuestionDetail>("/questions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.questions.all });
      toast.success("Question created", "The question has been added to the bank.");
    },
  });
}

export function useUpdateQuestionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<QuestionFormValues>) =>
      api.put<QuestionDetail>(`/questions/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.questions.all });
      queryClient.invalidateQueries({ queryKey: qk.questions.detail(variables.id) });
      toast.success("Question updated");
    },
  });
}

export function useDeleteQuestionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.questions.all });
      toast.success("Question deleted");
    },
  });
}

export function useBulkImportQuestionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      // Get pre-signed upload URL
      const { uploadUrl, fileKey } = await api.post<{ uploadUrl: string; fileKey: string }>(
        "/questions/import/upload-url",
        { fileName: file.name, contentType: file.type }
      );

      // Upload file to storage
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // Start import job
      const { jobId } = await api.post<{ jobId: string }>("/questions/import/start", { fileKey });
      return jobId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.questions.all });
      toast.success("Import started", "Processing your file...");
    },
  });
}

export function useBulkExportQuestionsMutation() {
  return useMutation({
    mutationFn: async (filters?: { subjectId?: string; topicId?: string; type?: string }) => {
      const response = await apiClient<{ downloadUrl: string }>("/questions/export", {
        method: "POST",
        body: JSON.stringify(filters || {}),
      });
      return response.downloadUrl;
    },
    onSuccess: (downloadUrl) => {
      // Trigger download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "questions-export.csv";
      a.click();
      toast.success("Export ready", "Your file is downloading.");
    },
  });
}

export function useGenerateSimilarMutation() {
  return useMutation({
    mutationFn: (questionId: string) =>
      api.post<QuestionFormValues>(`/questions/${questionId}/ai/generate-similar`),
    onSuccess: () => {
      toast.success("Similar question generated", "Review the generated question below.");
    },
  });
}

export function useGenerateExplanationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) =>
      api.post<{ explanation: string }>(`/questions/${questionId}/ai/generate-explanation`),
    onSuccess: (_data, questionId) => {
      queryClient.invalidateQueries({ queryKey: qk.questions.detail(questionId) });
      toast.success("Explanation generated");
    },
  });
}
