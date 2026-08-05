import { z } from 'zod';

export const TenantListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  status: z.enum(['active', 'suspended', 'trialing', 'canceled']).optional(),
  plan: z.string().trim().min(1).optional(),
});
export type TenantListQuery = z.infer<typeof TenantListQuerySchema>;

export const OverridePlanSchema = z.object({
  planId: z.string().min(1),
  trialDays: z.coerce.number().int().min(0).max(365).default(0),
});
export type OverridePlanInput = z.infer<typeof OverridePlanSchema>;

export const CreateFeatureFlagSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-_]*$/, 'lowercase letters, digits, "-" or "_"'),
  description: z.string().trim().max(500).default(''),
  rolloutPercentage: z.coerce.number().int().min(0).max(100).default(100),
});
export type CreateFeatureFlagInput = z.infer<typeof CreateFeatureFlagSchema>;

export const UpdateFeatureFlagSchema = z
  .object({
    enabled: z.boolean().optional(),
    rolloutPercentage: z.coerce.number().int().min(0).max(100).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'At least one field must be provided',
  });
export type UpdateFeatureFlagInput = z.infer<typeof UpdateFeatureFlagSchema>;
