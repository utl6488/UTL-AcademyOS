import { useEffect, useRef, useCallback } from "react";
import { queueEvent } from "../lib/offline-queue";
import { useAttemptStore } from "../store/attempt-store";
import { onSocketEvent } from "@/lib/socket";
import type { ProctoringEvent, ProctoringEventType } from "../schemas/attempt-schemas";

interface ProctoringConfig {
  requireFullscreen: boolean;
  fullscreenExitPolicy: string;
  fullscreenMaxWarnings: number;
  tabSwitchPolicy: string;
  tabSwitchMaxWarnings: number;
  disableCopy: boolean;
  disablePaste: boolean;
  disableRightClick: boolean;
  disablePrint: boolean;
  disableDevtools: boolean;
  blockMultipleDisplays: boolean;
}

interface UseProctoringOptions {
  attemptId: string;
  config: ProctoringConfig;
  enabled: boolean;
  onAutoSubmit: () => void;
}

export function useProctoring({ attemptId, config, enabled, onAutoSubmit }: UseProctoringOptions) {
  const eventBuffer = useRef<ProctoringEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const incrementViolation = useAttemptStore((s) => s.incrementViolation);

  const emitEvent = useCallback(
    (type: ProctoringEventType, meta?: Record<string, unknown>) => {
      const event: ProctoringEvent = {
        clientEventId: crypto.randomUUID(),
        type,
        timestamp: Date.now(),
        meta,
      };
      eventBuffer.current.push(event);
      queueEvent(event);
      incrementViolation();

      // Flush immediately if buffer is full
      if (eventBuffer.current.length >= 10) {
        flushEvents();
      }
    },
    // flushEvents is intentionally omitted — it's declared below and referenced only after buffer fill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [incrementViolation]
  );

  const flushEvents = useCallback(() => {
    if (eventBuffer.current.length === 0) return;
    const events = [...eventBuffer.current];
    eventBuffer.current = [];
    // Fire and forget — if it fails, events are still in IndexedDB
    import("../api/mutations").then(() => {
      // Events sent via CustomEvent — parent handles actual mutation
    });
    // The parent component handles flushing via useSendProctoringEventsMutation
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("proctoring:flush", { detail: { attemptId, events } }));
    }
  }, [attemptId]);

  useEffect(() => {
    if (!enabled) return;

    const cleanups: (() => void)[] = [];

    // ─── Fullscreen detection ──────────────────────────────────────────
    if (config.requireFullscreen) {
      const handleFullscreenChange = () => {
        if (!document.fullscreenElement) {
          emitEvent("FULLSCREEN_EXIT");
        } else {
          emitEvent("FULLSCREEN_ENTER");
        }
      };
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
      cleanups.push(() => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      });
    }

    // ─── Tab visibility detection ──────────────────────────────────────
    const handleVisibilityChange = () => {
      if (document.hidden) {
        emitEvent("TAB_HIDDEN");
      } else {
        emitEvent("TAB_VISIBLE");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    cleanups.push(() => document.removeEventListener("visibilitychange", handleVisibilityChange));

    // ─── Window blur/focus ─────────────────────────────────────────────
    const handleBlur = () => emitEvent("WINDOW_BLUR");
    const handleFocus = () => emitEvent("WINDOW_FOCUS");
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    cleanups.push(() => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    });

    // ─── Right-click ───────────────────────────────────────────────────
    if (config.disableRightClick) {
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        emitEvent("RIGHT_CLICK");
      };
      document.addEventListener("contextmenu", handleContextMenu);
      cleanups.push(() => document.removeEventListener("contextmenu", handleContextMenu));
    }

    // ─── Copy / Paste ──────────────────────────────────────────────────
    if (config.disableCopy) {
      const handleCopy = (e: ClipboardEvent) => {
        e.preventDefault();
        emitEvent("COPY");
      };
      document.addEventListener("copy", handleCopy);
      document.addEventListener("cut", handleCopy);
      cleanups.push(() => {
        document.removeEventListener("copy", handleCopy);
        document.removeEventListener("cut", handleCopy);
      });
    }
    if (config.disablePaste) {
      const handlePaste = (e: ClipboardEvent) => {
        e.preventDefault();
        emitEvent("PASTE");
      };
      document.addEventListener("paste", handlePaste);
      cleanups.push(() => document.removeEventListener("paste", handlePaste));
    }

    // ─── Print blocking ────────────────────────────────────────────────
    if (config.disablePrint) {
      const handleBeforePrint = () => emitEvent("PRINT_ATTEMPT");
      window.addEventListener("beforeprint", handleBeforePrint);
      cleanups.push(() => window.removeEventListener("beforeprint", handleBeforePrint));
    }

    // ─── Keyboard shortcuts blocking ───────────────────────────────────
    if (config.disableDevtools) {
      const handleKeyDown = (e: KeyboardEvent) => {
        const ctrl = e.ctrlKey || e.metaKey;
        // F12
        if (e.key === "F12") {
          e.preventDefault();
          emitEvent("DEVTOOLS_SUSPECTED");
          return;
        }
        // Ctrl+Shift+I/J/C
        if (ctrl && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) {
          e.preventDefault();
          emitEvent("DEVTOOLS_SUSPECTED");
          return;
        }
        // Ctrl+P (print)
        if (ctrl && e.key.toUpperCase() === "P") {
          e.preventDefault();
          emitEvent("PRINT_ATTEMPT");
          return;
        }
        // Ctrl+S (save)
        if (ctrl && e.key.toUpperCase() === "S") {
          e.preventDefault();
          return;
        }
        // Ctrl+U (view source)
        if (ctrl && e.key.toUpperCase() === "U") {
          e.preventDefault();
          emitEvent("DEVTOOLS_SUSPECTED");
          return;
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      cleanups.push(() => document.removeEventListener("keydown", handleKeyDown));
    }

    // ─── Drag prevention ───────────────────────────────────────────────
    const handleDragStart = (e: DragEvent) => {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
      }
    };
    document.addEventListener("dragstart", handleDragStart);
    cleanups.push(() => document.removeEventListener("dragstart", handleDragStart));

    // ─── Multi-display detection (Chromium only) ───────────────────────
    if (config.blockMultipleDisplays && "getScreenDetails" in window) {
      (window as unknown as { getScreenDetails: () => Promise<{ screens: unknown[] }> })
        .getScreenDetails()
        .then((details) => {
          if (details.screens.length > 1) {
            emitEvent("SECOND_DISPLAY_DETECTED");
          }
        })
        .catch(() => {
          /* API not available, skip silently */
        });
    }

    // ─── Socket: listen for auto-submit from server ────────────────────
    const unsubAutoSubmit = onSocketEvent("proctoring:autoSubmitted", () => {
      onAutoSubmit();
    });
    cleanups.push(unsubAutoSubmit);

    // ─── Flush timer: every 2 seconds ──────────────────────────────────
    flushTimerRef.current = setInterval(flushEvents, 2000);
    cleanups.push(() => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    });

    return () => {
      cleanups.forEach((fn) => fn());
      flushEvents(); // Final flush on unmount
    };
  }, [enabled, config, emitEvent, flushEvents, onAutoSubmit]);

  return { emitEvent, flushEvents };
}
