import { QueueName, getQueue } from '@/jobs/queues.js';

export type EmbeddingSourceType = 'question' | 'explanation' | 'syllabus';

export interface EmbeddingJobData {
  tenantId: string;
  sourceType: EmbeddingSourceType;
  sourceId: string;
  text: string;
}

/**
 * Enqueue an embedding job. Deduped on (tenant, source, id) so rapid successive
 * updates to the same source collapse to one worker run.
 */
export function enqueueEmbedding(job: EmbeddingJobData) {
  return getQueue(QueueName.EMBEDDING).add('embed', job, {
    jobId: `${job.tenantId}-${job.sourceType}-${job.sourceId}`,
  });
}
