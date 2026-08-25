import { Worker } from 'bullmq';

import { logger } from '@/common/logger.js';
import { withTenant } from '@/db/prisma.js';
import { getRedis } from '@/db/redis.js';
import { EXAM_NOTIFY_QUEUE_NAME, type ExamPublishedJobData } from '@/jobs/exam.queue.js';
import { notifyExamPublished } from '@/modules/exam/exam.notify.service.js';

export function startExamWorker(): Worker<ExamPublishedJobData> {
  const worker = new Worker<ExamPublishedJobData>(
    EXAM_NOTIFY_QUEUE_NAME,
    async (job) => {
      await withTenant({ tenantId: job.data.tenantId }, () => notifyExamPublished(job.data.examId));
    },
    { connection: getRedis(), concurrency: 4 },
  );
  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'exam-notify job failed');
  });
  return worker;
}
