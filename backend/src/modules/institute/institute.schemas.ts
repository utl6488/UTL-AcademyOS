import { z } from 'zod';

export const InstituteProfileUpdateSchema = z
  .object({
    name: z.string().min(3).max(120).optional(),
    slug: z.string().min(3).max(50).optional(),
    logo: z.string().url().nullable().optional(),
    timezone: z.string().min(1).optional(),
    address: z.string().max(500).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    email: z.string().email().nullable().optional(),
    website: z.string().url().nullable().optional(),
    brandColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
      .nullable()
      .optional(),
    gradingScheme: z.enum(['percentage', 'gpa', 'grade_letter']).optional(),
    passingPercentage: z.number().int().min(0).max(100).optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .strict();
export type InstituteProfileUpdate = z.infer<typeof InstituteProfileUpdateSchema>;

export const LogoUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});
export type LogoUploadUrlInput = z.infer<typeof LogoUploadUrlSchema>;
