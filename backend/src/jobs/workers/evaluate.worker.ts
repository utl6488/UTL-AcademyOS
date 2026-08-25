import { Worker } from 'bullmq';

import { logger } from '@/common/logger.js';
import { withTenant } from '@/db/prisma.js';
import { getRedis } from '@/db/redis.js';
import { type EvaluateJobData } from '@/jobs/evaluate.queue.js';
import { QueueName } from '@/jobs/queues.js';
import { evaluateAttempt } from '@/modules/attempt/evaluate.service.js';

export function startEvaluateWorker(): Worker<EvaluateJobData> {
  const worker = new Worker<EvaluateJobData>(
    QueueName.EVALUATION,
    async (job) => {
      await withTenant({ tenantId: job.data.tenantId }, () => evaluateAttempt(job.data.attemptId));
    },
    { connection: getRedis(), concurrency: 4 },
  );
  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'evaluate job failed');
  });
  return worker;
}
