import { Shield, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AttemptInfo } from "../schemas/attempt-schemas";

interface ExamIntroScreenProps {
  attemptInfo: AttemptInfo;
  onStart: () => void;
  isStarting: boolean;
  compatError?: string;
}

export function ExamIntroScreen({
  attemptInfo,
  onStart,
  isStarting,
  compatError,
}: ExamIntroScreenProps) {
  const { proctoring } = attemptInfo;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{attemptInfo.examTitle}</CardTitle>
          <div className="mt-2 flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> {attemptInfo.durationMinutes} minutes
            </span>
            <span>{attemptInfo.totalMarks} marks</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instructions */}
          {attemptInfo.instructions && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Instructions</h3>
              <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
                {attemptInfo.instructions}
              </div>
            </div>
          )}

          {/* Rules */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Exam Rules</h3>
            <ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
              {proctoring.requireFullscreen && (
                <li>This exam requires fullscreen mode. Exiting fullscreen will be recorded.</li>
              )}
              {proctoring.tabSwitchPolicy !== "flag_only" && (
                <li>
                  Switching tabs or windows will trigger warnings and may auto-submit your exam.
                </li>
              )}
              {proctoring.disableCopy && <li>Copy, paste, and right-click are disabled.</li>}
              <li>Your answers are auto-saved. Do not close the browser.</li>
              <li>Ensure a stable internet connection.</li>
            </ul>
          </div>

          <Separator />

          {/* Consent */}
          <div className="space-y-2 rounded-md bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm">
                By clicking "Start Exam", I agree to fullscreen mode. Exiting fullscreen or
                switching tabs will be recorded and may result in auto-submission of my exam.
              </p>
            </div>
          </div>

          {/* Compatibility error */}
          {compatError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{compatError}</p>
            </div>
          )}

          <Button
            onClick={onStart}
            loading={isStarting}
            disabled={!!compatError}
            className="w-full"
            size="lg"
          >
            Start Exam
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
