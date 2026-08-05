import { z } from "zod";

export const instituteProfileSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  slug: z.string().min(3).max(50),
  logo: z.string().url().optional().or(z.literal("")),
  timezone: z.string().min(1, "Timezone is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color")
    .optional(),
  gradingScheme: z.enum(["percentage", "gpa", "grade_letter"]).default("percentage"),
  passingPercentage: z.number().min(0).max(100).default(33),
});

export type InstituteProfileFormValues = z.infer<typeof instituteProfileSchema>;

export const instituteResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  timezone: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  brandColor: z.string().nullable(),
  gradingScheme: z.string(),
  passingPercentage: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Institute = z.infer<typeof instituteResponseSchema>;
