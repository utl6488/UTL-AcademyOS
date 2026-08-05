import * as Sentry from '@sentry/node';

import { logger } from '@/common/logger.js';
import { env } from '@/config/env.js';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (!env.SENTRY_DSN) {
    logger.info('Sentry DSN not configured — skipping init');
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
    profilesSampleRate: 0,
  });
  initialized = true;
  logger.info('Sentry initialized');
}

export { Sentry };
