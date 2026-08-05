import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import type { InviteTeacherFormValues, ImportPreview } from "../schemas/user-schemas";

export function useInviteTeacherMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteTeacherFormValues) => api.post("/users/invite", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users.all });
      toast.success("Invitation sent", "Teacher will receive an email to set up their account.");
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.users.all });
      queryClient.invalidateQueries({ queryKey: qk.users.detail(variables.id) });
      toast.success("User updated");
    },
  });
}

export function useDeactivateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.patch(`/users/${userId}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users.all });
      toast.success("User deactivated");
    },
  });
}

export function useActivateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.patch(`/users/${userId}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.users.all });
      toast.success("User activated");
    },
  });
}

// Upload CSV and get pre-signed URL
export function useUploadImportFileMutation() {
  return useMutation({
    mutationFn: async (file: File) => {
      // Get pre-signed upload URL
      const { uploadUrl, fileKey } = await api.post<{ uploadUrl: string; fileKey: string }>(
        "/users/import/upload-url",
        { fileName: file.name, contentType: file.type }
      );

      // Upload to S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      return fileKey;
    },
  });
}

// Preview parsed CSV before import
export function usePreviewImportMutation() {
  return useMutation({
    mutationFn: async (fileKey: string) => {
      return api.post<ImportPreview>("/users/import/preview", { fileKey });
    },
  });
}

// Start the actual import job
export function useStartImportMutation() {
  return useMutation({
    mutationFn: async ({ fileKey, role }: { fileKey: string; role: "student" | "teacher" }) => {
      return api.post<{ jobId: string }>("/users/import/start", { fileKey, role });
    },
    onSuccess: () => {
      toast.success("Import started", "Processing your file...");
    },
  });
}

// Photo upload
export function useUploadPhotoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, file }: { userId: string; file: File }) => {
      const { uploadUrl, fileUrl } = await api.post<{ uploadUrl: string; fileUrl: string }>(
        `/users/${userId}/photo/upload-url`,
        { fileName: file.name, contentType: file.type }
      );

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      await api.patch(`/users/${userId}`, { avatar: fileUrl });

      return fileUrl;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.users.detail(variables.userId) });
      toast.success("Photo updated");
    },
  });
}
