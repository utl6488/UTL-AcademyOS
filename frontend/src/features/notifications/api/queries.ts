import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { Notification, NotificationPreference } from "../schemas/notification-schemas";

export interface NotificationFilters {
  read?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export function useNotifications(filters?: NotificationFilters) {
  return useQuery({
    queryKey: qk.notifications.list(filters),
    queryFn: () =>
      api.get<Notification[]>(
        "/notifications",
        filters as Record<string, string | number | boolean | string[] | undefined>
      ),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: qk.notifications.unreadCount(),
    queryFn: () => api.get<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 30_000, // poll every 30s
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: qk.notifications.preferences(),
    queryFn: () => api.get<NotificationPreference[]>("/notifications/preferences"),
  });
}
