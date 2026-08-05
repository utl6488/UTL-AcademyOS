import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import type { NotificationPreference } from "../schemas/notification-schemas";

export function useMarkReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.all });
    },
  });
}

export function useMarkAllReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/notifications/mark-all-read"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.all });
      toast.success("All notifications marked as read");
    },
  });
}

export function useUpdatePreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: NotificationPreference[]) =>
      api.put("/notifications/preferences", { preferences }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.preferences() });
      toast.success("Preferences updated");
    },
  });
}
