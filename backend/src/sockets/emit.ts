import { getIo, rooms } from './io.js';

import { logger } from '@/common/logger.js';

type AttemptSubmittedPayload = {
  attemptId: string;
  examId: string;
  studentId: string;
  status: 'SUBMITTED' | 'AUTO_SUBMITTED';
  reason?: 'TIME_UP' | 'POLICY' | 'FORCE' | 'STUDENT';
  at: number;
};

type AttemptFlaggedPayload = {
  attemptId: string;
  examId: string;
  studentId: string;
  eventTypes: string[];
  violationCounts: Record<string, number>;
  riskScore?: number;
  at: number;
};

/** Emit attempt-lifecycle events to both the attempt room and the exam console. */
export function emitAttemptSubmitted(payload: AttemptSubmittedPayload): void {
  const io = getIo();
  if (!io) return; // worker context or tests
  try {
    io.to(rooms.attempt(payload.attemptId)).emit('attempt:submitted', payload);
    io.to(rooms.examConsole(payload.examId)).emit('attempt:submitted', payload);
  } catch (err) {
    logger.warn({ err, payload }, 'socket emit failed: attempt:submitted');
  }
}

export function emitAttemptFlagged(payload: AttemptFlaggedPayload): void {
  const io = getIo();
  if (!io) return;
  try {
    io.to(rooms.examConsole(payload.examId)).emit('attempt:flagged', payload);
  } catch (err) {
    logger.warn({ err, payload }, 'socket emit failed: attempt:flagged');
  }
}
