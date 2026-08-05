import { useEffect, useRef, useCallback } from "react";
import { useAttemptStore } from "../store/attempt-store";
import { useSaveAnswersBatchMutation } from "../api/mutations";
import { queueAnswer, getQueuedAnswers, clearQueuedAnswers } from "../lib/offline-queue";
import type { Answer } from "../schemas/attempt-schemas";

/**
 * Auto-saves answers:
 * - On answer change (debounced 500ms)
 * - Heartbeat every 15s
 * - Flush offline queue on reconnect
 */
export function useAutoSave(attemptId: string) {
  const answers = useAttemptStore((s) => s.answers);
  const isDisconnected = useAttemptStore((s) => s.isDisconnected);
  const saveMutation = useSaveAnswersBatchMutation();
  const lastSavedRef = useRef<Map<string, string>>(new Map()); // questionId → answeredAt
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const getDirtyAnswers = useCallback((): Answer[] => {
    const dirty: Answer[] = [];
    answers.forEach((answer, questionId) => {
      const lastSaved = lastSavedRef.current.get(questionId);
      if (answer.answeredAt && answer.answeredAt !== lastSaved) {
        dirty.push(answer);
      }
    });
    return dirty;
  }, [answers]);

  const save = useCallback(async () => {
    if (!attemptId || isDisconnected) {
      // Queue for offline
      const dirty = getDirtyAnswers();
      for (const answer of dirty) {
        await queueAnswer(answer);
      }
      return;
    }

    const dirty = getDirtyAnswers();
    if (dirty.length === 0) return;

    try {
      await saveMutation.mutateAsync({ attemptId, answers: dirty });
      // Mark as saved
      dirty.forEach((a) => {
        if (a.answeredAt) lastSavedRef.current.set(a.questionId, a.answeredAt);
      });
    } catch {
      // Queue offline on failure
      for (const answer of dirty) {
        await queueAnswer(answer);
      }
    }
  }, [attemptId, isDisconnected, getDirtyAnswers, saveMutation]);

  // Debounced save on answer change
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(save, 500);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [answers, save]);

  // Heartbeat every 15s
  useEffect(() => {
    const interval = setInterval(save, 15000);
    return () => clearInterval(interval);
  }, [save]);

  // Flush offline queue on reconnect
  useEffect(() => {
    if (!isDisconnected && attemptId) {
      flushOfflineQueue(attemptId, saveMutation);
    }
  }, [isDisconnected, attemptId, saveMutation]);

  return { save, isSaving: saveMutation.isPending };
}

async function flushOfflineQueue(
  attemptId: string,
  saveMutation: ReturnType<typeof useSaveAnswersBatchMutation>
) {
  try {
    const queued = await getQueuedAnswers();
    if (queued.length > 0) {
      await saveMutation.mutateAsync({ attemptId, answers: queued });
      await clearQueuedAnswers();
    }
  } catch {
    // Will retry on next reconnect
  }
}
