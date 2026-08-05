import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError } from '@/common/errors/index.js';
import { logger } from '@/common/logger.js';

/** 404 handler — mounted after all routes. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(AppError.notFound('Route not found'));
};

/** Global error handler. Must be registered LAST. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.id;

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, requestId }, err.message);
    } else {
      logger.warn({ code: err.code, requestId, path: req.path }, err.message);
    }
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.expose ? err.message : 'Internal server error',
        details: err.expose ? err.details : undefined,
      },
      meta: requestId ? { requestId } : undefined,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      },
      meta: requestId ? { requestId } : undefined,
    });
    return;
  }

  logger.error({ err, requestId, path: req.path }, 'Unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    meta: requestId ? { requestId } : undefined,
  });
};
