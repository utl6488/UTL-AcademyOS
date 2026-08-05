import { cn } from "@/lib/utils";
import { useAttemptStore } from "../store/attempt-store";
import type { AttemptInfo } from "../schemas/attempt-schemas";

interface QuestionNavPanelProps {
  attemptInfo: AttemptInfo;
}

const STATUS_COLORS: Record<string, string> = {
  unanswered: "bg-muted text-muted-foreground border",
  answered: "bg-success text-success-foreground",
  marked: "bg-warning text-warning-foreground",
  marked_answered: "bg-primary text-primary-foreground",
};

export function QuestionNavPanel({ attemptInfo }: QuestionNavPanelProps) {
  const currentSectionIndex = useAttemptStore((s) => s.currentSectionIndex);
  const currentQuestionIndex = useAttemptStore((s) => s.currentQuestionIndex);
  const getQuestionStatus = useAttemptStore((s) => s.getQuestionStatus);
  const setCurrentQuestion = useAttemptStore((s) => s.setCurrentQuestion);

  let globalIndex = 0;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border bg-muted" /> Unanswered
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-success" /> Answered
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-warning" /> Marked
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-primary" /> Marked + Answered
        </span>
      </div>

      {/* Grid per section */}
      {attemptInfo.sections.map((section, sIndex) => (
        <div key={section.id} className="space-y-2">
          {attemptInfo.sections.length > 1 && (
            <p className="text-xs font-medium text-muted-foreground">{section.title}</p>
          )}
          <div className="grid grid-cols-8 gap-1.5">
            {section.questions.map((question, qIndex) => {
              const current = sIndex === currentSectionIndex && qIndex === currentQuestionIndex;
              const status = getQuestionStatus(question.questionId);
              const displayNum = ++globalIndex;

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentQuestion(sIndex, qIndex)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-all",
                    STATUS_COLORS[status],
                    current && "ring-2 ring-ring ring-offset-1"
                  )}
                  aria-label={`Question ${displayNum} - ${status}`}
                  aria-current={current ? "true" : undefined}
                >
                  {displayNum}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
