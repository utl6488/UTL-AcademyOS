import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import type {
  BranchFormValues,
  ClassFormValues,
  BatchFormValues,
  SubjectFormValues,
  TopicFormValues,
} from "../schemas/org-schemas";

// ─── Branches ────────────────────────────────────────────

export function useCreateBranchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BranchFormValues) => api.post("/org/branches", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org.branches.all });
      toast.success("Branch created");
    },
  });
}

export function useUpdateBranchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: BranchFormValues & { id: string }) =>
      api.put(`/org/branches/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org.branches.all });
      toast.success("Branch updated");
    },
  });
}

export function useDeleteBranchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/org/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org.branches.all });
      toast.success("Branch deleted");
    },
  });
}

// ─── Classes ─────────────────────────────────────────────

export function useCreateClassMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClassFormValues) => api.post("/org/classes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org.classes.all });
      toast.success("Class created");
    },
  });
}

export function useUpdateClassMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: ClassFormValues & { id: string }) =>
      api.put(`/org/classes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org.classes.all });
      toast.success("Class updated");
    },
  });
}

export function useDeleteClassMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/org/classes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org.classes.all });
      toast.success("Class deleted");
    },
  });
}

// ─── Batches ─────────────────────────────────────────────

export function useCreateBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BatchFormValues) => api.post("/org/batches", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org.batches.all });
      toast.success("Batch created");
    },
  });
}

export function useUpdateBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: BatchFormValues & { id: string }) =>
      api.put(`/org/batches/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org.batches.all });
      toast.success("Batch updated");
    },
  });
}

export function useDeleteBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/org/batches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org.batches.all });
      toast.success("Batch deleted");
    },
  });
}

// ─── Subjects ────────────────────────────────────────────

export function useCreateSubjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SubjectFormValues) => api.post("/org/subjects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org.subjects.all });
      toast.success("Subject created");
    },
  });
}

export function useUpdateSubjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: SubjectFormValues & { id: string }) =>
      api.put(`/org/subjects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org.subjects.all });
      toast.success("Subject updated");
    },
  });
}

export function useDeleteSubjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/org/subjects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org.subjects.all });
      toast.success("Subject deleted");
    },
  });
}

// ─── Topics ──────────────────────────────────────────────

export function useCreateTopicMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TopicFormValues) => api.post(`/org/subjects/${data.subjectId}/topics`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.org.subjects.topics(variables.subjectId) });
      toast.success("Topic created");
    },
  });
}

export function useUpdateTopicMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: TopicFormValues & { id: string }) =>
      api.put(`/org/topics/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.org.subjects.topics(variables.subjectId) });
      toast.success("Topic updated");
    },
  });
}

export function useDeleteTopicMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, subjectId: _subjectId }: { id: string; subjectId: string }) =>
      api.delete(`/org/topics/${id}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.org.subjects.topics(variables.subjectId) });
      toast.success("Topic deleted");
    },
  });
}
