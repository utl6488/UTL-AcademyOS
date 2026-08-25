import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Flag, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { api } from "@/lib/api-client";
import { useAttemptInfo, useAttemptAnswers } from "../api/queries";
import { useStartAttemptMutation, useSubmitAttemptMutation } from "../api/mutations";
import { useAttemptStore } from "../store/attempt-store";
import { useExamTimer } from "../hooks/use-exam-timer";
import { useAutoSave } from "../hooks/use-auto-save";
import { useProctoring } from "../hooks/use-proctoring";
import { clearAllQueues } from "../lib/offline-queue";
import { formatTimer } from "@/lib/format";
import { ExamIntroScreen } from "../components/ExamIntroScreen";
import { SyncLobbyScreen } from "../components/SyncLobbyScreen";
import { LockedOutScreen } from "../components/LockedOutScreen";
import { QuestionNavPanel } from "../components/QuestionNavPanel";
import { QuestionRenderer } from "../components/QuestionRenderer";
import { ViolationWarningModal } from "../components/ViolationWarningModal";
import { DisconnectModal } from "../components/DisconnectModal";
import { SubmitConfirmDialog } from "../components/SubmitConfirmDialog";
import { PostSubmitScreen } from "../components/PostSubmitScreen";
import { cn } from "@/lib/utils";

type Phase = "loading" | "intro" | "lobby" | "locked_out" | "in_progress" | "submitted";

export default function ExamAttemptPage() {
  const { id: examId } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [violationReason] = useState<"fullscreen" | "tab_switch">("fullscreen");
  const [submitResult, setSubmitResult] = useState<{ score?: number } | null>(null);

  // Store
  const attemptInfo = useAttemptStore((s) => s.attemptInfo);
  const setAttemptInfo = useAttemptStore((s) => s.setAttemptInfo);
  const setAnswers = useAttemptStore((s) => s.setAnswers);
  const currentSectionIndex = useAttemptStore((s) => s.currentSectionIndex);
  const currentQuestionIndex = useAttemptStore((s) => s.currentQuestionIndex);
  const setCurrentQuestion = useAttemptStore((s) => s.setCurrentQuestion);
  const toggleMark = useAttemptStore((s) => s.toggleMark);
  const getQuestionStatus = useAttemptStore((s) => s.getQuestionStatus);
  const isDisconnected = useAttemptStore((s) => s.isDisconnected);
  const violationCount = useAttemptStore((s) => s.violationCount);
  const reset = useAttemptStore((s) => s.reset);

  // Queries
  const { data: attemptData, isLoading, isError, refetch } = useAttemptInfo(attemptId || "");
  const { data: savedAnswers } = useAttemptAnswers(attemptId || "");

  // Mutations
  const startMutation = useStartAttemptMutation();
  const submitMutation = useSubmitAttemptMutation();

  // Reserve an attempt row on first mount so the intro screen has data to render.
  // `reserve` is idempotent server-side — returns the existing attempt if one exists.
  // Uses `api.post` directly (not useMutation) because useMutation-in-useEffect
  // subscriptions get lost in StrictMode + Suspense/lazy — the mutation resolved
  // but the observer never notified React of the state change.
  const reserveTriggeredRef = useRef(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  useEffect(() => {
    if (!examId || attemptId || reserveTriggeredRef.current) return;
    reserveTriggeredRef.current = true;
    api
      .post<{ attemptId: string }>(`/attempts/reserve`, { examId })
      .then((res) => setAttemptId(res.attemptId))
      .catch((err) => {
        reserveTriggeredRef.current = false;
        setReserveError(err instanceof Error ? err.message : "Failed to open exam");
      });
  }, [examId, attemptId]);

  // Timer
  const { remainingSeconds, isExpired, isLastMinute } = useExamTimer();

  // Auto-save
  useAutoSave(attemptId || "");

  // Proctoring
  const handleAutoSubmit = useCallback(() => {
    if (attemptId) {
      submitMutation.mutate(attemptId, {
        onSuccess: () => {
          setPhase("submitted");
          clearAllQueues();
        },
      });
    }
  }, [attemptId, submitMutation]);

  useProctoring({
    attemptId: attemptId || "",
    config: attemptInfo?.proctoring || {
      requireFullscreen: false,
      fullscreenExitPolicy: "flag_only",
      fullscreenMaxWarnings: 3,
      tabSwitchPolicy: "flag_only",
      tabSwitchMaxWarnings: 3,
      disableCopy: false,
      disablePaste: false,
      disableRightClick: false,
      disablePrint: false,
      disableDevtools: false,
      blockMultipleDisplays: false,
    },
    enabled: phase === "in_progress",
    onAutoSubmit: handleAutoSubmit,
  });

  // Load attempt info
  useEffect(() => {
    if (attemptData) {
      setAttemptInfo(attemptData);
      if (attemptData.status === "LOCKED_OUT") setPhase("locked_out");
      else if (attemptData.status === "SUBMITTED" || attemptData.status === "AUTO_SUBMITTED")
        setPhase("submitted");
      else if (attemptData.status === "IN_PROGRESS") setPhase("in_progress");
      else if (attemptData.status === "LOBBY") setPhase("lobby");
      else setPhase("intro");
    }
  }, [attemptData, setAttemptInfo]);

  // Load saved answers
  useEffect(() => {
    if (savedAnswers) setAnswers(savedAnswers);
  }, [savedAnswers, setAnswers]);

  // Auto-submit on time expiry
  useEffect(() => {
    if (isExpired && phase === "in_progress") {
      handleAutoSubmit();
    }
  }, [isExpired, phase, handleAutoSubmit]);

  // Cleanup on unmount
  useEffect(() => () => reset(), [reset]);

  // ─── Handlers ──────────────────────────────────────────────────────

  async function handleStart() {
    if (!examId) return;
    const result = await startMutation.mutateAsync(examId);
    setAttemptId(result.attemptId);

    // Request fullscreen
    if (attemptInfo?.proctoring.requireFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        /* User may deny */
      }
    }
    setPhase("in_progress");
  }

  function handleLobbyReady() {
    setPhase("in_progress");
  }

  function handleSubmit() {
    if (!attemptId) return;
    submitMutation.mutate(attemptId, {
      onSuccess: (data) => {
        setSubmitResult(data);
        setPhase("submitted");
        clearAllQueues();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      },
    });
  }

  function handleResumeFromViolation() {
    setShowViolationModal(false);
    if (attemptInfo?.proctoring.requireFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  // Nav helpers
  const currentSection = attemptInfo?.sections[currentSectionIndex];
  const currentQuestion = currentSection?.questions[currentQuestionIndex];
  const totalQuestions = attemptInfo?.sections.reduce((s, sec) => s + sec.questions.length, 0) || 0;

  let globalQuestionNumber = 0;
  for (let s = 0; s < currentSectionIndex; s++) {
    globalQuestionNumber += attemptInfo?.sections[s].questions.length || 0;
  }
  globalQuestionNumber += currentQuestionIndex + 1;

  function goNext() {
    if (!attemptInfo) return;
    if (currentQuestionIndex < (currentSection?.questions.length || 0) - 1) {
      setCurrentQuestion(currentSectionIndex, currentQuestionIndex + 1);
    } else if (currentSectionIndex < attemptInfo.sections.length - 1) {
      setCurrentQuestion(currentSectionIndex + 1, 0);
    }
  }

  function goPrev() {
    if (currentQuestionIndex > 0) {
      setCurrentQuestion(currentSectionIndex, currentQuestionIndex - 1);
    } else if (currentSectionIndex > 0) {
      const prevSection = attemptInfo!.sections[currentSectionIndex - 1];
      setCurrentQuestion(currentSectionIndex - 1, prevSection.questions.length - 1);
    }
  }

  // ─── Render Phases ─────────────────────────────────────────────────

  if (reserveError) {
    return (
      <ErrorState
        title="Unable to open this exam"
        description={reserveError}
        onRetry={() => {
          reserveTriggeredRef.current = false;
          setReserveError(null);
        }}
      />
    );
  }
  if (phase === "loading" || isLoading) return <LoadingSkeleton variant="page" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!attemptInfo) return <LoadingSkeleton variant="page" />;

  if (phase === "intro") {
    return (
      <ExamIntroScreen
        attemptInfo={attemptInfo}
        onStart={handleStart}
        isStarting={startMutation.isPending}
      />
    );
  }

  if (phase === "lobby") {
    return <SyncLobbyScreen attemptInfo={attemptInfo} onReady={handleLobbyReady} />;
  }

  if (phase === "locked_out") {
    return <LockedOutScreen />;
  }

  if (phase === "submitted") {
    return (
      <PostSubmitScreen
        examTitle={attemptInfo.examTitle}
        score={submitResult?.score}
        totalMarks={attemptInfo.totalMarks}
        showImmediateResult={!!submitResult?.score}
      />
    );
  }

  // ─── In-Progress Exam UI ───────────────────────────────────────────

  return (
    <div
      className={cn(
        "flex min-h-screen select-none flex-col",
        attemptInfo.proctoring.disableCopy && "[&_*:not(input):not(textarea)]:select-none"
      )}
      onContextMenu={
        attemptInfo.proctoring.disableRightClick ? (e) => e.preventDefault() : undefined
      }
    >
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-3">
          <h1 className="max-w-[200px] truncate text-sm font-semibold">{attemptInfo.examTitle}</h1>
          {attemptInfo.sections.length > 1 && (
            <Badge variant="outline" className="text-xs">
              {currentSection?.title}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Violation counter */}
          {violationCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {violationCount} violation{violationCount > 1 ? "s" : ""}
            </Badge>
          )}
          {/* Timer */}
          <div
            className={cn(
              "font-mono text-lg font-bold tabular-nums",
              isLastMinute ? "animate-pulse text-destructive" : "text-foreground"
            )}
          >
            {formatTimer(remainingSeconds)}
          </div>
          {/* Submit */}
          <Button size="sm" onClick={() => setShowSubmitDialog(true)}>
            <Send className="mr-1 h-3.5 w-3.5" /> Submit
          </Button>
        </div>
      </header>

      {/* Last-minute banner */}
      {isLastMinute && (
        <div className="bg-destructive py-1.5 text-center text-sm font-medium text-destructive-foreground">
          ⚠️ Less than 1 minute remaining! Your exam will be auto-submitted.
        </div>
      )}

      {/* Late-entry banner */}
      {attemptInfo.mode === "SYNCHRONOUS" && attemptInfo.lateEntryGraceMs > 0 && (
        <div className="bg-warning py-1.5 text-center text-sm font-medium text-warning-foreground">
          You joined late. Your timer reflects the remaining exam time.
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Question area */}
        <main className="flex-1 overflow-y-auto p-6">
          {currentQuestion && (
            <QuestionRenderer question={currentQuestion} questionNumber={globalQuestionNumber} />
          )}

          {/* Navigation buttons */}
          <div className="mt-8 flex items-center justify-between border-t pt-4">
            <Button variant="outline" onClick={goPrev} disabled={globalQuestionNumber === 1}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <div className="flex gap-2">
              {currentQuestion && (
                <Button
                  variant="outline"
                  onClick={() => toggleMark(currentQuestion.questionId)}
                  className={
                    getQuestionStatus(currentQuestion.questionId).includes("marked")
                      ? "border-warning text-warning"
                      : ""
                  }
                >
                  <Flag className="mr-1 h-4 w-4" />
                  {getQuestionStatus(currentQuestion.questionId).includes("marked")
                    ? "Unmark"
                    : "Mark for Review"}
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              onClick={goNext}
              disabled={globalQuestionNumber === totalQuestions}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </main>

        {/* Side panel - question grid */}
        <aside className="hidden w-64 overflow-y-auto border-l p-4 lg:block">
          <QuestionNavPanel attemptInfo={attemptInfo} />
        </aside>
      </div>

      {/* Modals */}
      {showViolationModal && (
        <ViolationWarningModal
          reason={violationReason}
          maxWarnings={
            violationReason === "fullscreen"
              ? attemptInfo.proctoring.fullscreenMaxWarnings
              : attemptInfo.proctoring.tabSwitchMaxWarnings
          }
          onResume={handleResumeFromViolation}
        />
      )}
      {isDisconnected && <DisconnectModal isSynchronous={attemptInfo.mode === "SYNCHRONOUS"} />}
      <SubmitConfirmDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        onConfirm={handleSubmit}
        isSubmitting={submitMutation.isPending}
      />
    </div>
  );
}
