import { z } from 'zod';

import {
  AttemptStatus,
  Difficulty,
  ExamStartMode,
  ExamStatus,
  QuestionType,
  Role,
  SubscriptionPlan,
  SubscriptionStatus,
} from './enums.js';

const enumFromConst = <T extends Record<string, string>>(obj: T) =>
  z.enum(Object.values(obj) as [T[keyof T], ...T[keyof T][]]);

export const RoleSchema = enumFromConst(Role);
export const ExamStatusSchema = enumFromConst(ExamStatus);
export const ExamStartModeSchema = enumFromConst(ExamStartMode);
export const AttemptStatusSchema = enumFromConst(AttemptStatus);
export const QuestionTypeSchema = enumFromConst(QuestionType);
export const DifficultySchema = enumFromConst(Difficulty);
export const SubscriptionPlanSchema = enumFromConst(SubscriptionPlan);
export const SubscriptionStatusSchema = enumFromConst(SubscriptionStatus);

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

export const IdSchema = z.string().min(1);
export const TenantIdSchema = z.string().min(1);
export const EmailSchema = z.string().email().max(254);
export const PasswordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128);

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export const SignupSchema = z.object({
  instituteName: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(120),
  email: EmailSchema,
  password: PasswordSchema,
});
export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/* -------------------------------------------------------------------------- */
/* Response envelope                                                          */
/* -------------------------------------------------------------------------- */

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiMetaSchema = z
  .object({
    requestId: z.string().optional(),
    page: z.number().optional(),
    pageSize: z.number().optional(),
    total: z.number().optional(),
  })
  .partial();
export type ApiMeta = z.infer<typeof ApiMetaSchema>;
