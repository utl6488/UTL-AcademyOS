import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { logger } from '@/common/logger.js';
import { errorHandler, notFoundHandler } from '@/common/middleware/errorHandler.js';
import { readCategoryLimit, writeCategoryLimit } from '@/common/middleware/rateLimit.js';
import { requestId } from '@/common/middleware/requestId.js';
import { env } from '@/config/env.js';
import { mountOpenApi } from '@/docs/openapi.js';
import { adminRouter } from '@/modules/admin/admin.routes.js';
import { aiRouter } from '@/modules/ai/ai.routes.js';
import { analyticsRouter } from '@/modules/analytics/analytics.routes.js';
import { attemptRouter } from '@/modules/attempt/attempt.routes.js';
import { authRouter } from '@/modules/auth/auth.routes.js';
import { billingRouter } from '@/modules/billing/billing.routes.js';
import { examRouter } from '@/modules/exam/exam.routes.js';
import { gradingRouter } from '@/modules/grading/grading.routes.js';
import { healthRouter } from '@/modules/health/health.routes.js';
import { instituteRouter } from '@/modules/institute/institute.routes.js';
import { orgRouter } from '@/modules/org/org.routes.js';
import { questionRouter } from '@/modules/question/question.routes.js';
import { resultRouter } from '@/modules/result/result.routes.js';
import { userRouter } from '@/modules/user/user.routes.js';

/** Build the Express app. Kept factory-shaped so tests can spin up isolated instances. */
export function createApp(): Express {
  const app = express();

  // Trust one proxy hop (Nginx / LB); adjust in prod as needed.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({ requestId: (req as unknown as express.Request).id }),
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );
  // Strict security headers. This backend serves JSON exclusively; the only
  // HTML surface is Swagger UI at /api/docs, which gets a relaxed CSP below.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      strictTransportSecurity: {
        maxAge: 60 * 60 * 24 * 365, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      xFrameOptions: { action: 'deny' },
    }),
  );

  // Swagger UI needs inline scripts + styles; give /api/docs a relaxed CSP so
  // the strict policy above doesn't break the docs page.
  app.use('/api/docs', (_req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:",
    );
    next();
  });
  app.use(compression());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      exposedHeaders: ['x-request-id'],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Docs
  mountOpenApi(app);

  // v1 API. Health mounts first so probes stay unrate-limited; everything else
  // inherits the read/write baseline (endpoint-specific limiters stack on top).
  const v1 = express.Router();
  v1.use('/health', healthRouter);
  v1.use(readCategoryLimit(), writeCategoryLimit());
  v1.use('/auth', authRouter);
  v1.use('/institute', instituteRouter);
  v1.use('/org', orgRouter);
  v1.use('/users', userRouter);
  v1.use('/questions', questionRouter);
  v1.use('/exams', examRouter);
  v1.use('/attempts', attemptRouter);
  v1.use('/grading', gradingRouter);
  v1.use('/results', resultRouter);
  v1.use('/analytics', analyticsRouter);
  v1.use('/ai', aiRouter);
  v1.use('/billing', billingRouter);
  v1.use('/admin', adminRouter);
  app.use('/api/v1', v1);

  // 404 + error handler must be last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
