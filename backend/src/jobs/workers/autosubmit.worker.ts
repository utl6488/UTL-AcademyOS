import { Worker } from 'bullmq';

import { logger } from '@/common/logger.js';
import { getPrisma, withTenant } from '@/db/prisma.js';
import { getRedis } from '@/db/redis.js';
import { type AutoSubmitJobData } from '@/jobs/exam.queue.js';
import { QueueName } from '@/jobs/queues.js';
import { autoSubmitAttempt } from '@/modules/attempt/attempt.service.js';

export function startAutoSubmitWorker(): Worker<AutoSubmitJobData> {
  const worker = new Worker<AutoSubmitJobData>(
    QueueName.EXAM_AUTOSUBMIT,
    async (job) => {
      const rec = await getPrisma().examAttempt.findUnique({
        where: { id: job.data.attemptId },
        select: { tenantId: true },
      });
      if (!rec) return;
      await withTenant({ tenantId: rec.tenantId }, () =>
        autoSubmitAttempt(job.data.attemptId, 'TIME_UP'),
      );
    },
    { connection: getRedis(), concurrency: 8 },
  );
  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'auto-submit job failed');
  });
  return worker;
}
