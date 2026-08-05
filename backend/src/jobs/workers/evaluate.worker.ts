import { Worker } from 'bullmq';

import { logger } from '@/common/logger.js';
import { getPrisma, withTenant } from '@/db/prisma.js';
import { getRedis } from '@/db/redis.js';
import { type EvaluateJobData } from '@/jobs/evaluate.queue.js';
import { QueueName } from '@/jobs/queues.js';
import { evaluateAttempt } from '@/modules/attempt/evaluate.service.js';

export function startEvaluateWorker(): Worker<EvaluateJobData> {
  const worker = new Worker<EvaluateJobData>(
    QueueName.EVALUATION,
    async (job) => {
      const rec = await getPrisma().examAttempt.findUnique({
        where: { id: job.data.attemptId },
        select: { tenantId: true },
      });
      if (!rec) return;
      await withTenant({ tenantId: rec.tenantId }, () => evaluateAttempt(job.data.attemptId));
    },
    { connection: getRedis(), concurrency: 4 },
  );
  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'evaluate job failed');
  });
  return worker;
}
