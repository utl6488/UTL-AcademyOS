import { useEffect } from "react";
import { Clock, Radio } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCountdown } from "../hooks/use-exam-timer";
import { useReserveAttemptMutation } from "../api/mutations";
import { formatTimer } from "@/lib/format";
import type { AttemptInfo } from "../schemas/attempt-schemas";

interface SyncLobbyScreenProps {
  attemptInfo: AttemptInfo;
  onReady: () => void;
}

export function SyncLobbyScreen({ attemptInfo, onReady }: SyncLobbyScreenProps) {
  const { remainingSeconds, isReady } = useCountdown(attemptInfo.startAt);
  const reserveMutation = useReserveAttemptMutation();

  // Pre-warm attempt on mount
  useEffect(() => {
    reserveMutation.mutate(attemptInfo.examId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-transition when countdown hits zero
  useEffect(() => {
    if (isReady) {
      onReady();
    }
  }, [isReady, onReady]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="space-y-6 py-12">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Radio className="h-8 w-8 animate-pulse text-primary" />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold">{attemptInfo.examTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Synchronous Exam — Waiting to start
            </p>
          </div>

          {/* Countdown */}
          <div className="space-y-2">
            <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> Exam starts in
            </p>
            <p className="font-mono text-5xl font-bold tabular-nums text-primary">
              {formatTimer(remainingSeconds)}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            The exam will start automatically when the countdown reaches zero. Please stay on this
            page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
