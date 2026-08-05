import { Worker } from 'bullmq';

import { logger } from '@/common/logger.js';
import { getPrisma, withTenant } from '@/db/prisma.js';
import { getRedis } from '@/db/redis.js';
import { IMPORT_QUEUE_NAME, type ImportJobData } from '@/jobs/import.queue.js';
import { runQuestionImportJob } from '@/modules/question/question.import.service.js';
import { runImportJob } from '@/modules/user/user.import.service.js';

export function startImportWorker(): Worker<ImportJobData> {
  const worker = new Worker<ImportJobData>(
    IMPORT_QUEUE_NAME,
    async (job) => {
      const rec = await getPrisma().importJob.findUnique({
        where: { id: job.data.jobId },
        select: { tenantId: true, kind: true },
      });
      if (!rec) return;
      await withTenant({ tenantId: rec.tenantId }, () =>
        rec.kind === 'QUESTION'
          ? runQuestionImportJob(job.data.jobId)
          : runImportJob(job.data.jobId),
      );
    },
    { connection: getRedis(), concurrency: 2 },
  );
  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'import job failed');
  });
  return worker;
}
