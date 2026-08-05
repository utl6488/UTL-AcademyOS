import {
  EmailSchema,
  PasswordSchema,
  SignupSchema,
  LoginSchema,
  type SignupInput,
  type LoginInput,
} from '@utl/shared';
import { z } from 'zod';

// Re-export the shared ones so the module surface stays flat.
export { EmailSchema, PasswordSchema, SignupSchema, LoginSchema };
export type { SignupInput, LoginInput };

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  password: PasswordSchema,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const VerifyEmailSchema = z.object({
  token: z.string().min(10),
});
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

export const ResendVerificationSchema = z.object({
  email: EmailSchema,
});
export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;
