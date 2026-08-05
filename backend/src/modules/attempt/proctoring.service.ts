import { Prisma } from '@prisma/client';

import type { ProctoringEventsBatchInput } from './attempt.schemas.js';
import { autoSubmitAttempt } from './attempt.service.js';

import { logger } from '@/common/logger.js';
import { getPrisma } from '@/db/prisma.js';
import { getRedis } from '@/db/redis.js';
import { emitAttemptFlagged } from '@/sockets/emit.js';

// ---------------------------------------------------------------------------
// Redis violation counters. Redis is the source of truth for warning counts —
// DB persistence via AttemptEvent is for audit + teacher review.
// ---------------------------------------------------------------------------

const COUNTER_TTL_SECONDS = 6 * 3600; // ~2× longest exam window

function counterKey(attemptId: string, kind: 'fullscreenExits' | 'tabSwitches'): string {
  return `attempt:${attemptId}:violations:${kind}`;
}

async function increment(
  attemptId: string,
  kind: 'fullscreenExits' | 'tabSwitches',
): Promise<number> {
  const redis = getRedis();
  const key = counterKey(attemptId, kind);
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, COUNTER_TTL_SECONDS);
  return n;
}

// ---------------------------------------------------------------------------
// Public: batched ingest
// ---------------------------------------------------------------------------

export async function ingestProctoringEvents(
  studentId: string,
  attemptId: string,
  batch: ProctoringEventsBatchInput,
): Promise<{
  policyAction?: 'warn' | 'auto_submit' | 'flag_only';
  violationCounts: Record<string, number>;
}> {
  const prisma = getPrisma();
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId },
    include: { exam: true },
  });
  if (!attempt) throw new Error('attempt not found');
  if (attempt.studentId !== studentId) throw new Error('forbidden');
  if (attempt.status !== 'IN_PROGRESS') {
    // Nothing to do; drop silently.
    return { violationCounts: {} };
  }

  // Idempotent DB persist keyed on clientEventId.
  const rows = batch.events.map((e) => ({
    tenantId: attempt.tenantId,
    attemptId,
    type: e.type,
    clientEventId: e.clientEventId,
    clientAt: new Date(e.timestamp),
    meta: (e.meta ?? Prisma.DbNull) as Prisma.InputJsonValue,
  }));
  if (rows.length) {
    await prisma.attemptEvent.createMany({ data: rows, skipDuplicates: true });
  }

  // Increment counters for violation-shaped events.
  const proctoring = (attempt.exam.proctoring ?? {}) as Record<string, unknown>;
  const fullscreenPolicy = (proctoring.fullscreenExitPolicy as string) ?? 'warn_then_submit';
  const fullscreenMax = Number(proctoring.fullscreenMaxWarnings ?? 3);
  const tabPolicy = (proctoring.tabSwitchPolicy as string) ?? 'warn_then_submit';
  const tabMax = Number(proctoring.tabSwitchMaxWarnings ?? 3);

  let fullscreenExits = 0;
  let tabSwitches = 0;

  for (const e of batch.events) {
    if (e.type === 'FULLSCREEN_EXIT')
      fullscreenExits = await increment(attemptId, 'fullscreenExits');
    else if (e.type === 'TAB_HIDDEN' || e.type === 'WINDOW_BLUR')
      tabSwitches = await increment(attemptId, 'tabSwitches');
  }

  let policyAction: 'warn' | 'auto_submit' | 'flag_only' | undefined;

  if (fullscreenPolicy === 'auto_submit' && fullscreenExits > fullscreenMax) {
    policyAction = 'auto_submit';
    await autoSubmitAttempt(attemptId, 'POLICY');
  } else if (fullscreenPolicy === 'warn_then_submit' && fullscreenExits > fullscreenMax) {
    policyAction = 'auto_submit';
    await autoSubmitAttempt(attemptId, 'POLICY');
  } else if (fullscreenExits > 0 && fullscreenPolicy !== 'flag_only') {
    policyAction = 'warn';
  }

  if (!policyAction) {
    if (tabPolicy === 'auto_submit' && tabSwitches > tabMax) {
      policyAction = 'auto_submit';
      await autoSubmitAttempt(attemptId, 'POLICY');
    } else if (tabPolicy === 'warn_then_submit' && tabSwitches > tabMax) {
      policyAction = 'auto_submit';
      await autoSubmitAttempt(attemptId, 'POLICY');
    } else if (tabSwitches > 0 && tabPolicy !== 'flag_only') {
      policyAction = 'warn';
    }
  }

  logger.debug(
    { attemptId, fullscreenExits, tabSwitches, policyAction },
    'proctoring: batch ingested',
  );

  // Push to teacher live-console when the batch contains anything meaningful.
  // Skip "return-to-normal" events (fullscreen re-entered, tab visible, window focused).
  const RESTORATIVE = new Set(['FULLSCREEN_ENTER', 'TAB_VISIBLE', 'WINDOW_FOCUS']);
  const flaggedTypes = batch.events.filter((e) => !RESTORATIVE.has(e.type)).map((e) => e.type);
  if (flaggedTypes.length > 0) {
    const riskScore = await computeRiskScore(attemptId).catch(() => undefined);
    emitAttemptFlagged({
      attemptId,
      examId: attempt.examId,
      studentId: attempt.studentId,
      eventTypes: Array.from(new Set(flaggedTypes)),
      violationCounts: { fullscreenExits, tabSwitches },
      riskScore,
      at: Date.now(),
    });
  }

  return {
    policyAction: policyAction ?? 'flag_only',
    violationCounts: { fullscreenExits, tabSwitches },
  };
}

/// Risk score 0-100 for teacher live-console + summary reports.
export async function computeRiskScore(attemptId: string): Promise<number> {
  const prisma = getPrisma();
  const events = await prisma.attemptEvent.findMany({
    where: { attemptId },
    select: { type: true },
  });
  const weights: Record<string, number> = {
    FULLSCREEN_EXIT: 5,
    TAB_HIDDEN: 3,
    WINDOW_BLUR: 3,
    PASTE: 2,
    COPY: 1,
    SECOND_DISPLAY_DETECTED: 8,
    DEVTOOLS_SUSPECTED: 6,
    RIGHT_CLICK: 0.5,
    PRINT_ATTEMPT: 4,
  };
  const raw = events.reduce((sum, e) => sum + (weights[e.type] ?? 0), 0);
  return Math.min(100, Math.round(raw));
}
