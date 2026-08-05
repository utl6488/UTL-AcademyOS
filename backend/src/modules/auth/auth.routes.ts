import { Router } from 'express';

import { requireAuth } from '@/common/middleware/auth.js';
import { rateLimit } from '@/common/middleware/rateLimit.js';
import { validate } from '@/common/middleware/validate.js';
import * as ctrl from '@/modules/auth/auth.controller.js';
import {
  ForgotPasswordSchema,
  LoginSchema,
  RefreshSchema,
  ResendVerificationSchema,
  ResetPasswordSchema,
  SignupSchema,
  VerifyEmailSchema,
} from '@/modules/auth/auth.schemas.js';
import { me } from '@/modules/auth/me.controller.js';

export const authRouter = Router();

// Aggressive rate limits on unauthenticated auth endpoints — cheap DoS surface.
const strictLimit = rateLimit({ windowMs: 15 * 60_000, max: 20, key: 'auth-strict' });
const looseLimit = rateLimit({ windowMs: 15 * 60_000, max: 60, key: 'auth-loose' });

authRouter.post('/signup', strictLimit, validate({ body: SignupSchema }), ctrl.signup);
authRouter.post('/login', strictLimit, validate({ body: LoginSchema }), ctrl.login);
authRouter.post('/refresh', looseLimit, validate({ body: RefreshSchema }), ctrl.refresh);
authRouter.post('/logout', validate({ body: RefreshSchema }), ctrl.logout);
authRouter.post('/logout-all', requireAuth, ctrl.logoutAll);

authRouter.post(
  '/verify-email',
  looseLimit,
  validate({ body: VerifyEmailSchema }),
  ctrl.verifyEmail,
);
authRouter.post(
  '/resend-verification',
  strictLimit,
  validate({ body: ResendVerificationSchema }),
  ctrl.resendVerification,
);

authRouter.post(
  '/forgot-password',
  strictLimit,
  validate({ body: ForgotPasswordSchema }),
  ctrl.forgotPassword,
);
authRouter.post(
  '/reset-password',
  strictLimit,
  validate({ body: ResetPasswordSchema }),
  ctrl.resetPassword,
);

authRouter.get('/me', requireAuth, me);
authRouter.get('/sessions', requireAuth, ctrl.listSessions);
authRouter.delete('/sessions/:familyId', requireAuth, ctrl.revokeSession);
