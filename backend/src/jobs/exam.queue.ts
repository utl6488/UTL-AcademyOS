import { QueueName, getQueue } from './queues.js';

// "exam:notify" carries exam-publish-side-effect fanout (email students +
// pre-warm cache). Kept separate from `exam:autosubmit` (Phase 6) so failures
// on one don't block the other.
const EXAM_NOTIFY_QUEUE_NAME = 'exam:notify' as const;

type LocalQueueName = QueueName | typeof EXAM_NOTIFY_QUEUE_NAME;

export interface ExamPublishedJobData {
  tenantId: string;
  examId: string;
}

export function enqueueExamPublished(data: ExamPublishedJobData) {
  return getQueue(EXAM_NOTIFY_QUEUE_NAME as unknown as LocalQueueName as QueueName).add(
    'exam.published',
    data,
    { jobId: `exam-published:${data.examId}` },
  );
}

// Auto-submit — per-attempt delayed job. Real SYNCHRONOUS mass-submit job is
// a Phase B10.a follow-up; this per-attempt variant is safe as an MVP.
export interface AutoSubmitJobData {
  tenantId: string;
  attemptId: string;
}

export function enqueueAutoSubmit(data: AutoSubmitJobData, delayMs: number) {
  return getQueue(QueueName.EXAM_AUTOSUBMIT).add('attempt.autosubmit', data, {
    delay: delayMs,
    jobId: `autosubmit:${data.attemptId}`,
  });
}

export { EXAM_NOTIFY_QUEUE_NAME };
