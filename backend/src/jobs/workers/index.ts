import { type Worker } from 'bullmq';

import { logger } from '@/common/logger.js';
import { startAutoSubmitWorker } from '@/jobs/workers/autosubmit.worker.js';
import { startDigestWorker } from '@/jobs/workers/digest.worker.js';
import { startDunningWorker } from '@/jobs/workers/dunning.worker.js';
import { startEmailWorker } from '@/jobs/workers/email.worker.js';
import { startEmbeddingWorker } from '@/jobs/workers/embedding.worker.js';
import { startEvaluateWorker } from '@/jobs/workers/evaluate.worker.js';
import { startExamWorker } from '@/jobs/workers/exam.worker.js';
import { startImportWorker } from '@/jobs/workers/import.worker.js';

let started: Worker[] = [];

/** Boot every BullMQ worker for this process. */
export function startWorkers(): void {
  if (started.length) return;
  started = [
    startEmailWorker(),
    startImportWorker(),
    startExamWorker(),
    startEvaluateWorker(),
    startAutoSubmitWorker(),
    startEmbeddingWorker(),
    startDunningWorker(),
    startDigestWorker(),
  ];
  logger.info({ workers: started.length }, 'workers started');
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(started.map((w) => w.close()));
  started = [];
}
