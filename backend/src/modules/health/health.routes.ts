import { Router } from 'express';

import { ok } from '@/common/response.js';
import { getPrismaHealth } from '@/db/prisma.js';
import { getRedisHealth } from '@/db/redis.js';

const startedAt = Date.now();

export const healthRouter = Router();

/**
 * Liveness — process is up. No downstream checks.
 * K8s-friendly: returns 200 immediately.
 */
healthRouter.get('/live', (_req, res) => {
  ok(res, { status: 'ok', uptime: Math.floor((Date.now() - startedAt) / 1000) });
});

/**
 * Readiness — the app can serve traffic (DB + Redis reachable).
 * K8s uses this to gate load balancer inclusion.
 */
healthRouter.get('/ready', async (_req, res) => {
  const [db, redis] = await Promise.all([getPrismaHealth(), getRedisHealth()]);
  const ready = db.ok && redis.ok;
  res.status(ready ? 200 : 503).json({
    data: { ready, checks: { db, redis } },
  });
});

/** Combined status for humans. */
healthRouter.get('/', async (_req, res) => {
  const [db, redis] = await Promise.all([getPrismaHealth(), getRedisHealth()]);
  ok(res, {
    status: db.ok && redis.ok ? 'healthy' : 'degraded',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    checks: { db, redis },
  });
});
