import { z } from "zod";

// ─── Tenant ─────────────────────────────────────────────────────────────────

export const tenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  planName: z.string(),
  status: z.enum(["active", "suspended", "trialing", "canceled"]),
  usersCount: z.number(),
  revenue: z.number(),
  createdAt: z.string(),
});

export type Tenant = z.infer<typeof tenantSchema>;

// ─── Tenant Detail ──────────────────────────────────────────────────────────

export const tenantDetailSchema = tenantSchema.extend({
  owner: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  subscription: z.object({
    planId: z.string(),
    planName: z.string(),
    status: z.string(),
    currentPeriodEnd: z.string(),
  }),
  usage: z.object({
    students: z.object({ used: z.number(), limit: z.number() }),
    exams: z.object({ used: z.number(), limit: z.number() }),
    aiCredits: z.object({ used: z.number(), limit: z.number() }),
    storage: z.object({ usedMb: z.number(), limitMb: z.number() }),
  }),
});

export type TenantDetail = z.infer<typeof tenantDetailSchema>;

// ─── Revenue Metrics ────────────────────────────────────────────────────────

export const monthlyDataPointSchema = z.object({
  month: z.string(),
  revenue: z.number(),
});

export const revenueMetricsSchema = z.object({
  mrr: z.number(),
  arr: z.number(),
  growthRate: z.number(),
  churnRate: z.number(),
  monthlyData: z.array(monthlyDataPointSchema),
});

export type RevenueMetrics = z.infer<typeof revenueMetricsSchema>;
export type MonthlyDataPoint = z.infer<typeof monthlyDataPointSchema>;

// ─── Feature Flag ───────────────────────────────────────────────────────────

export const featureFlagSchema = z.object({
  id: z.string(),
  key: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  rolloutPercentage: z.number(),
});

export type FeatureFlag = z.infer<typeof featureFlagSchema>;

// ─── System Health ──────────────────────────────────────────────────────────

export const systemHealthSchema = z.object({
  status: z.enum(["healthy", "degraded", "down"]),
  uptime: z.number(),
  dbConnections: z.number(),
  cacheHitRate: z.number(),
  queueDepth: z.number(),
  errorRate: z.number(),
});

export type SystemHealth = z.infer<typeof systemHealthSchema>;

// ─── Plan Override Request ──────────────────────────────────────────────────

export const overridePlanRequestSchema = z.object({
  tenantId: z.string(),
  planId: z.string(),
  trialDays: z.coerce.number().min(0),
});

export type OverridePlanRequest = z.infer<typeof overridePlanRequestSchema>;

// ─── Create Feature Flag Request ────────────────────────────────────────────

export const createFeatureFlagRequestSchema = z.object({
  key: z.string().min(1, "Key is required"),
  description: z.string(),
  rolloutPercentage: z.coerce.number().min(0).max(100),
});

export type CreateFeatureFlagRequest = z.infer<typeof createFeatureFlagRequestSchema>;
