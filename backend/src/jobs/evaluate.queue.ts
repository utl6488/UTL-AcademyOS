import { QueueName, getQueue } from './queues.js';

export interface EvaluateJobData {
  tenantId: string;
  attemptId: string;
}

export function enqueueEvaluate(data: EvaluateJobData) {
  return getQueue(QueueName.EVALUATION).add('evaluate', data, {
    jobId: `evaluate:${data.attemptId}`,
  });
}
