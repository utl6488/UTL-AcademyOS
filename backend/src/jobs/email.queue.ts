import { QueueName, getQueue } from '@/jobs/queues.js';

export interface EmailJobData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export function enqueueEmail(job: EmailJobData) {
  return getQueue(QueueName.EMAIL).add('send', job, {
    // idempotency on (to + subject + first 32 chars of text) to squash dupes
    jobId: `${job.to.replace(/:/g, '_')}__${hash(`${job.subject}:${job.text.slice(0, 32)}:${Date.now()}`)}`,
  });
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
