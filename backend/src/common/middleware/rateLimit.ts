import type { RequestHandler } from 'express';
import rateLimitLib, { type Options } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

import { getRedis } from '@/db/redis.js';

interface Opts {
  windowMs: number;
  max: number;
  /** Namespace so different endpoints don't share a bucket. */
  key: string;
  /** Custom keyGenerator override (default: IP + user id if authed). */
  keyGenerator?: Options['keyGenerator'];
  /** Return true to skip the limiter for this request. */
  skip?: Options['skip'];
}

export function rateLimit({ windowMs, max, key, keyGenerator, skip }: Opts): RequestHandler {
  const store = new RedisStore({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand: (...args: string[]) => (getRedis() as any).call(...args),
    prefix: `rl:${key}:`,
  });

  return rateLimitLib({
    windowMs,
    max,
    store,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip,
    keyGenerator:
      keyGenerator ??
      ((req) => {
        const ip = req.ip ?? 'unknown';
        return req.auth ? `${ip}|u:${req.auth.userId}` : ip;
      }),
  });
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Baseline read limiter — 300 requests/min per IP+user. Endpoint-specific
 * limits can stack on top. Skips writes so the write limiter can apply.
 */
export function readCategoryLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    max: 300,
    key: 'read',
    skip: (req) => !READ_METHODS.has(req.method),
  });
}

/**
 * Baseline write limiter — 60 requests/min per IP+user for mutating verbs.
 */
export function writeCategoryLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    max: 60,
    key: 'write',
    skip: (req) => READ_METHODS.has(req.method),
  });
}
