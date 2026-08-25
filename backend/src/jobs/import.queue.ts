import { type QueueName, getQueue } from './queues.js';

export interface ImportJobData {
  jobId: string;
}

// Re-use the "email" queue infra pattern — importer runs on its own named queue.
const IMPORT_QUEUE_NAME = 'import' as const;

// Extend the QueueName union locally without editing shared enum module.
type LocalQueueName = QueueName | typeof IMPORT_QUEUE_NAME;

export function enqueueImport(data: ImportJobData) {
  return getQueue(IMPORT_QUEUE_NAME as unknown as LocalQueueName as QueueName).add('run', data, {
    jobId: `import-${data.jobId}`,
  });
}

export { IMPORT_QUEUE_NAME };
