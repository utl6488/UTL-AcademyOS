import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAttemptStore } from "../store/attempt-store";

interface SubmitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function SubmitConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: SubmitConfirmDialogProps) {
  const unansweredCount = useAttemptStore((s) => s.getUnansweredCount());
  const markedCount = useAttemptStore((s) => s.getMarkedCount());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Exam?</DialogTitle>
          <DialogDescription>Once submitted, you cannot change your answers.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {unansweredCount > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-warning/10 p-3 text-sm text-warning">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                {unansweredCount} question{unansweredCount > 1 ? "s" : ""} unanswered
              </span>
            </div>
          )}
          {markedCount > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-primary/10 p-3 text-sm text-primary">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                {markedCount} question{markedCount > 1 ? "s" : ""} marked for review
              </span>
            </div>
          )}
          {unansweredCount === 0 && markedCount === 0 && (
            <p className="text-sm text-success">All questions answered. Ready to submit.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Go Back
          </Button>
          <Button onClick={onConfirm} loading={isSubmitting}>
            Submit Exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
