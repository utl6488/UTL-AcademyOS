import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import type { InstituteProfileFormValues } from "../schemas/institute-schemas";

export function useUpdateInstituteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InstituteProfileFormValues) => {
      return api.put("/institute/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.institute.profile() });
      toast.success("Institute profile updated");
    },
  });
}

export function useUploadLogoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      // Get pre-signed URL
      const { uploadUrl, fileUrl } = await api.post<{ uploadUrl: string; fileUrl: string }>(
        "/institute/logo/upload-url",
        { fileName: file.name, contentType: file.type }
      );

      // Upload to S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // Update institute with new logo URL
      await api.patch("/institute/profile", { logo: fileUrl });

      return fileUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.institute.profile() });
      toast.success("Logo updated");
    },
  });
}
