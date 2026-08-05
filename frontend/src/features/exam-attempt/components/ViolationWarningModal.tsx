import { AlertTriangle, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAttemptStore } from "../store/attempt-store";

interface ViolationWarningModalProps {
  reason: "fullscreen" | "tab_switch";
  maxWarnings: number;
  onResume: () => void;
}

export function ViolationWarningModal({
  reason,
  maxWarnings,
  onResume,
}: ViolationWarningModalProps) {
  const violationCount = useAttemptStore((s) => s.violationCount);
  const remaining = Math.max(0, maxWarnings - violationCount);
  const isLast = remaining <= 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md space-y-4 rounded-lg bg-background p-8 text-center shadow-2xl">
        <div className="flex justify-center">
          <div className={`rounded-full p-3 ${isLast ? "bg-destructive/10" : "bg-warning/10"}`}>
            <AlertTriangle className={`h-8 w-8 ${isLast ? "text-destructive" : "text-warning"}`} />
          </div>
        </div>

        <h2 className="text-xl font-bold">
          {reason === "fullscreen" ? "Fullscreen Required" : "Tab Switch Detected"}
        </h2>

        <p className="text-sm text-muted-foreground">
          {reason === "fullscreen"
            ? "You exited fullscreen mode. Please return to fullscreen to continue your exam."
            : "You left the exam window. This has been recorded."}
        </p>

        <div className={`text-sm font-medium ${isLast ? "text-destructive" : "text-warning"}`}>
          {isLast
            ? "⚠️ Next violation will auto-submit your exam!"
            : `Warnings: ${violationCount} of ${maxWarnings}`}
        </div>

        <Button onClick={onResume} className="w-full" size="lg">
          <Maximize className="mr-2 h-4 w-4" />
          {reason === "fullscreen" ? "Return to Fullscreen" : "Continue Exam"}
        </Button>
      </div>
    </div>
  );
}
