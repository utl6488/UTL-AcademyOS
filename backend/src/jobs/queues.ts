import { Queue, type QueueOptions } from 'bullmq';

import { getRedis } from '@/db/redis.js';

/** Named queues used across the app. Add new ones here as modules land. */
export const QueueName = {
  EMAIL: 'email',
  EMBEDDING: 'embedding',
  EVALUATION: 'evaluation',
  EXAM_AUTOSUBMIT: 'exam:autosubmit',
  DUNNING: 'billing:dunning',
  INSTITUTE_DIGEST: 'insights:weekly-digest',
} as const;
export type QueueName = (typeof QueueName)[keyof typeof QueueName];

const baseOpts = (): QueueOptions => ({
  connection: getRedis(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 500, age: 24 * 3600 },
    removeOnFail: { count: 5000, age: 7 * 24 * 3600 },
  },
});

const cache = new Map<string, Queue>();

export function getQueue(name: QueueName): Queue {
  let q = cache.get(name);
  if (!q) {
    q = new Queue(name, baseOpts());
    cache.set(name, q);
  }
  return q;
}

export async function closeAllQueues(): Promise<void> {
  await Promise.all(Array.from(cache.values()).map((q) => q.close()));
  cache.clear();
}
