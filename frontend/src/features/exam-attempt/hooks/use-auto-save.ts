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
  // Refs decouple effects from react-query's changing object identity, which
  // otherwise causes effects to refire on every mutation state change.
  const answersRef = useRef(answers);
  const isDisconnectedRef = useRef(isDisconnected);
  const attemptIdRef = useRef(attemptId);
  const mutateAsyncRef = useRef(saveMutation.mutateAsync);
  const inFlightRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
    isDisconnectedRef.current = isDisconnected;
    attemptIdRef.current = attemptId;
    mutateAsyncRef.current = saveMutation.mutateAsync;
  });

  const getDirtyAnswers = useCallback((): Answer[] => {
    const dirty: Answer[] = [];
    answersRef.current.forEach((answer, questionId) => {
      const lastSaved = lastSavedRef.current.get(questionId);
      if (answer.answeredAt && answer.answeredAt !== lastSaved) {
        dirty.push(answer);
      }
    });
    return dirty;
  }, []);

  const save = useCallback(async () => {
    const currentAttemptId = attemptIdRef.current;
    if (!currentAttemptId || isDisconnectedRef.current) {
      const dirty = getDirtyAnswers();
      for (const answer of dirty) {
        await queueAnswer(answer);
      }
      return;
    }

    if (inFlightRef.current) return;
    const dirty = getDirtyAnswers();
    if (dirty.length === 0) return;

    inFlightRef.current = true;
    try {
      await mutateAsyncRef.current({ attemptId: currentAttemptId, answers: dirty });
      dirty.forEach((a) => {
        if (a.answeredAt) lastSavedRef.current.set(a.questionId, a.answeredAt);
      });
    } catch {
      for (const answer of dirty) {
        await queueAnswer(answer);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [getDirtyAnswers]);

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

  // Flush offline queue on reconnect (transition from disconnected → connected)
  useEffect(() => {
    if (isDisconnected || !attemptId) return;
    let cancelled = false;
    (async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const queued = await getQueuedAnswers();
        if (cancelled || queued.length === 0) return;
        await mutateAsyncRef.current({ attemptId, answers: queued });
        if (!cancelled) await clearQueuedAnswers();
      } catch {
        // Will retry on next reconnect
      } finally {
        inFlightRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDisconnected, attemptId]);

  return { save, isSaving: saveMutation.isPending };
}
