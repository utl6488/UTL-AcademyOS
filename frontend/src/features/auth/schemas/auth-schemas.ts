import { z } from "zod";

const PasswordSchema = z.string().min(8, "Password must be at least 8 characters").max(128);

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    instituteName: z
      .string()
      .min(3, "Institute name must be at least 3 characters")
      .max(120, "Institute name must be less than 120 characters"),
    ownerName: z
      .string()
      .min(2, "Owner name is required")
      .max(120, "Owner name must be less than 120 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: PasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms and conditions" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type SignupFormValues = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: PasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

// ------------------------- API response shapes --------------------------

const RoleSchema = z.enum([
  "SUPER_ADMIN",
  "INSTITUTE_OWNER",
  "ADMIN",
  "TEACHER",
  "EXAM_COORDINATOR",
  "STUDENT",
]);

const StatusSchema = z.enum(["ACTIVE", "INVITED", "SUSPENDED", "DELETED"]);

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
  status: StatusSchema,
  emailVerified: z.boolean(),
  tenantId: z.string(),
  tenant: z.object({ id: z.string(), name: z.string(), slug: z.string() }).optional(),
  permissions: z.array(z.string()),
  lastLoginAt: z.string().nullish(),
});

export const authResponseSchema = z.object({
  user: userSchema,
  tokens: z.object({
    access: z.string(),
    refresh: z.string(),
  }),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  familyId: z.string(),
  userAgent: z.string().nullish(),
  ip: z.string().nullish(),
  createdAt: z.string(),
  expiresAt: z.string(),
});
export type Session = z.infer<typeof sessionSchema>;
