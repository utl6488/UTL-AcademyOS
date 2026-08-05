import { z } from "zod";

// ─── Plan ───────────────────────────────────────────────────────────────────

export const planLimitsSchema = z.object({
  students: z.number(),
  exams: z.number(),
  aiCredits: z.number(),
  storage: z.number(),
});

export type PlanLimits = z.infer<typeof planLimitsSchema>;

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  interval: z.enum(["monthly", "yearly"]),
  features: z.array(z.string()),
  limits: planLimitsSchema,
});

export type Plan = z.infer<typeof planSchema>;

// ─── Subscription ───────────────────────────────────────────────────────────

export const subscriptionSchema = z.object({
  id: z.string(),
  planId: z.string(),
  planName: z.string(),
  status: z.enum(["active", "past_due", "canceled", "trialing", "incomplete"]),
  currentPeriodEnd: z.string(),
  cancelAtPeriodEnd: z.boolean(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

// ─── Usage ──────────────────────────────────────────────────────────────────

export const usageMeterSchema = z.object({
  used: z.number(),
  limit: z.number(),
});

export type UsageMeter = z.infer<typeof usageMeterSchema>;

export const usageSchema = z.object({
  students: usageMeterSchema,
  exams: usageMeterSchema,
  aiCredits: usageMeterSchema,
  storage: z.object({
    usedMb: z.number(),
    limitMb: z.number(),
  }),
});

export type Usage = z.infer<typeof usageSchema>;

// ─── Invoice ────────────────────────────────────────────────────────────────

export const invoiceSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(["paid", "open", "void", "uncollectible"]),
  paidAt: z.string().nullable(),
  downloadUrl: z.string(),
});

export type Invoice = z.infer<typeof invoiceSchema>;

// ─── Checkout Request ───────────────────────────────────────────────────────

export const createCheckoutRequestSchema = z.object({
  planId: z.string(),
  provider: z.enum(["stripe", "razorpay"]),
});

export type CreateCheckoutRequest = z.infer<typeof createCheckoutRequestSchema>;

// ─── Coupon Request ─────────────────────────────────────────────────────────

export const applyCouponRequestSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
});

export type ApplyCouponRequest = z.infer<typeof applyCouponRequestSchema>;
