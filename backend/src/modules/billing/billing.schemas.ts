import { z } from 'zod';

export const CreateCheckoutSchema = z.object({
  planId: z.string().min(1),
  provider: z.enum(['stripe', 'razorpay']),
});
export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>;

export const ApplyCouponSchema = z.object({
  code: z.string().min(1),
});
export type ApplyCouponInput = z.infer<typeof ApplyCouponSchema>;
