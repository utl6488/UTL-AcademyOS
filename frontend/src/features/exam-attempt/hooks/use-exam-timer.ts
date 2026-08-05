import { useState, useEffect } from "react";
import { useAttemptStore } from "../store/attempt-store";
import { onSocketEvent } from "@/lib/socket";
import type { SocketTimeSync } from "@/lib/socket";

/**
 * Server-synced countdown timer.
 * Receives time:sync events from socket every 15s.
 * Returns remaining seconds.
 */
export function useExamTimer() {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(Infinity);
  const syncServerTime = useAttemptStore((s) => s.syncServerTime);
  const getRemainingMs = useAttemptStore((s) => s.getRemainingMs);
  const attemptInfo = useAttemptStore((s) => s.attemptInfo);

  // Listen for server time sync
  useEffect(() => {
    const unsub = onSocketEvent<SocketTimeSync>("time:sync", (data) => {
      syncServerTime(data.serverTime);
    });
    return unsub;
  }, [syncServerTime]);

  // Tick every second
  useEffect(() => {
    if (!attemptInfo?.endsAt) return;

    const tick = () => {
      const ms = getRemainingMs();
      setRemainingSeconds(Math.ceil(ms / 1000));
    };

    tick(); // Initial
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attemptInfo?.endsAt, getRemainingMs]);

  const isExpired = remainingSeconds <= 0;
  const isLastMinute = remainingSeconds > 0 && remainingSeconds <= 60;

  return { remainingSeconds, isExpired, isLastMinute };
}

/**
 * Countdown to a specific timestamp (for lobby countdown).
 */
export function useCountdown(targetTime: string | null) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(Infinity);
  const serverTimeOffset = useAttemptStore((s) => s.serverTimeOffset);

  useEffect(() => {
    if (!targetTime) return;

    const tick = () => {
      const serverNow = Date.now() - serverTimeOffset;
      const target = new Date(targetTime).getTime();
      const diff = Math.ceil((target - serverNow) / 1000);
      setRemainingSeconds(Math.max(0, diff));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetTime, serverTimeOffset]);

  const isReady = remainingSeconds <= 0;

  return { remainingSeconds, isReady };
}
