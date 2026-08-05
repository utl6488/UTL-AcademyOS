import { Worker } from 'bullmq';

import { logger } from '@/common/logger.js';
import { withTenant } from '@/db/prisma.js';
import { getRedis } from '@/db/redis.js';
import { QueueName, getQueue } from '@/jobs/queues.js';
import { runDunningPass } from '@/modules/billing/dunning.service.js';

/**
 * Runs the dunning pass once per day. We schedule a BullMQ repeatable job at
 * boot; BullMQ's `jobId` + repeat opts make this idempotent across restarts.
 */
export function startDunningWorker(): Worker {
  // Ensure the repeatable schedule is registered. Safe to call every boot.
  const queue = getQueue(QueueName.DUNNING);
  queue
    .add(
      'run',
      {},
      {
        repeat: { pattern: '0 3 * * *' }, // daily at 03:00 UTC
        jobId: 'dunning-daily',
        removeOnComplete: true,
        removeOnFail: 50,
      },
    )
    .catch((err: unknown) => logger.warn({ err }, 'dunning: could not schedule repeatable'));

  const worker = new Worker(
    QueueName.DUNNING,
    async () => {
      // Bypass tenant scope — dunning is a platform-level scan across all tenants.
      const summary = await withTenant({ tenantId: '__system__', bypass: true }, () =>
        runDunningPass(),
      );
      logger.info(summary, 'dunning pass complete');
    },
    { connection: getRedis(), concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'dunning job failed');
  });

  return worker;
}
