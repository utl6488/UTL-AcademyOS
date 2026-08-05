import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import type {
  ExamDetail,
  ExamSection,
  ProctoringConfig,
  ExamScheduleStepValues,
  ExamDetailsStepValues,
} from "../schemas/exam-schemas";

interface CreateExamPayload extends ExamDetailsStepValues {
  sections: ExamSection[];
  mode: ExamScheduleStepValues["mode"];
  startAt?: string;
  endAt?: string;
  lateEntryGraceMs?: number;
  lockdownOnLate?: boolean;
  assignedClasses?: string[];
  assignedBatches?: string[];
  assignedStudents?: string[];
  proctoring: ProctoringConfig;
}

export function useCreateExamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExamPayload) => api.post<ExamDetail>("/exams", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.exams.all });
      toast.success("Exam created", "You can now add questions and publish.");
    },
  });
}

export function useUpdateExamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CreateExamPayload>) =>
      api.put<ExamDetail>(`/exams/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.exams.all });
      queryClient.invalidateQueries({ queryKey: qk.exams.detail(variables.id) });
      toast.success("Exam updated");
    },
  });
}

export function usePublishExamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/exams/${id}/publish`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: qk.exams.all });
      queryClient.invalidateQueries({ queryKey: qk.exams.detail(id) });
      toast.success("Exam published", "The exam is now scheduled and visible to students.");
    },
  });
}

export function useUnpublishExamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/exams/${id}/unpublish`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: qk.exams.all });
      queryClient.invalidateQueries({ queryKey: qk.exams.detail(id) });
      toast.success("Exam unpublished", "Moved back to draft.");
    },
  });
}

export function useDuplicateExamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ExamDetail>(`/exams/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.exams.all });
      toast.success("Exam duplicated", "A copy has been created as draft.");
    },
  });
}

export function useDeleteExamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/exams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.exams.all });
      toast.success("Exam deleted");
    },
  });
}

// Live console actions
export function useForcSubmitAttemptMutation() {
  return useMutation({
    mutationFn: ({ examId, attemptId }: { examId: string; attemptId: string }) =>
      api.post(`/exams/${examId}/attempts/${attemptId}/force-submit`),
    onSuccess: () => {
      toast.success("Attempt force-submitted");
    },
  });
}

export function useSendWarningMutation() {
  return useMutation({
    mutationFn: ({
      examId,
      attemptId,
      message,
    }: {
      examId: string;
      attemptId: string;
      message: string;
    }) => api.post(`/exams/${examId}/attempts/${attemptId}/send-warning`, { message }),
    onSuccess: () => {
      toast.success("Warning sent to student");
    },
  });
}
