import { z } from "zod";

// ─── Notification ───────────────────────────────────────────────────────────

export const notificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
  link: z.string().optional(),
});

export type Notification = z.infer<typeof notificationSchema>;

// ─── Notification Preference ────────────────────────────────────────────────

export const notificationPreferenceSchema = z.object({
  eventType: z.string(),
  email: z.boolean(),
  inApp: z.boolean(),
});

export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;
