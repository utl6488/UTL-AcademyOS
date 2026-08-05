import { Redis, type Redis as RedisClient } from 'ioredis';

import { logger } from '@/common/logger.js';
import { env } from '@/config/env.js';

let client: RedisClient | null = null;

export function getRedis(): RedisClient {
  if (client) return client;
  const c = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  c.on('error', (err) => logger.error({ err }, 'Redis error'));
  c.on('connect', () => logger.info('Redis connected'));
  client = c;
  return c;
}

export async function disconnectRedis(): Promise<void> {
  const c = client;
  if (!c) return;
  client = null;
  await c.quit().catch(() => c.disconnect());
}

/** Non-throwing health probe. */
export async function getRedisHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const pong = await getRedis().ping();
    return { ok: pong === 'PONG' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
