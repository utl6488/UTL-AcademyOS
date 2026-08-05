import { Worker } from 'bullmq';

import { logger } from '@/common/logger.js';
import { getRedis } from '@/db/redis.js';
import { QueueName, getQueue } from '@/jobs/queues.js';
import { runWeeklyDigestPass } from '@/modules/ai/digest.service.js';

/**
 * Weekly institute insights digest worker. Schedules a BullMQ repeatable job at
 * boot (Monday 06:00 UTC) and runs the digest pass across every active tenant.
 * The pass itself bypasses tenant scope internally, then re-enters each tenant
 * for its own metric queries + owner lookup.
 */
export function startDigestWorker(): Worker {
  const queue = getQueue(QueueName.INSTITUTE_DIGEST);
  queue
    .add(
      'run',
      {},
      {
        repeat: { pattern: '0 6 * * 1' }, // Monday 06:00 UTC
        jobId: 'weekly-digest',
        removeOnComplete: true,
        removeOnFail: 50,
      },
    )
    .catch((err: unknown) => logger.warn({ err }, 'digest: could not schedule repeatable'));

  const worker = new Worker(
    QueueName.INSTITUTE_DIGEST,
    async () => {
      const summary = await runWeeklyDigestPass();
      logger.info(summary, 'weekly digest pass complete');
    },
    { connection: getRedis(), concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'weekly digest job failed');
  });

  return worker;
}
