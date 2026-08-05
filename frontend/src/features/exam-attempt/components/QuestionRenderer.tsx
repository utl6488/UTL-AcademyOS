import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAttemptStore } from "../store/attempt-store";

interface QuestionRendererProps {
  question: {
    id: string;
    questionId: string;
    text: string;
    type: string;
    marks: number;
    options: { id: string; text: string }[] | null;
    imageUrl: string | null;
    blanksCount: number | null;
    unit: string | null;
  };
  questionNumber: number;
}

export function QuestionRenderer({ question, questionNumber }: QuestionRendererProps) {
  const answers = useAttemptStore((s) => s.answers);
  const updateAnswer = useAttemptStore((s) => s.updateAnswer);
  const currentAnswer = answers.get(question.questionId);

  return (
    <div className="space-y-6">
      {/* Question header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Q{questionNumber}</span>
            <Badge variant="outline" className="text-xs">
              {question.type.replace("_", " ")}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {question.marks} mark{question.marks !== 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="whitespace-pre-wrap text-base font-medium leading-relaxed">
            {question.type === "FILL_BLANK"
              ? question.text.replace(/\[blank\]/g, "________")
              : question.text}
          </p>
        </div>
      </div>

      {/* Image */}
      {question.imageUrl && (
        <img
          src={question.imageUrl}
          alt="Question image"
          className="max-h-64 max-w-full rounded-md border"
        />
      )}

      {/* Answer area by type */}
      <AnswerInput
        question={question}
        currentAnswer={currentAnswer?.answer}
        onAnswer={(val) => updateAnswer(question.questionId, val)}
      />
    </div>
  );
}

function AnswerInput({
  question,
  currentAnswer,
  onAnswer,
}: {
  question: QuestionRendererProps["question"];
  currentAnswer: unknown;
  onAnswer: (val: unknown) => void;
}) {
  switch (question.type) {
    case "MCQ":
    case "IMAGE_BASED":
      return (
        <div className="space-y-2">
          {question.options?.map((opt) => (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                currentAnswer === opt.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name={`q-${question.questionId}`}
                checked={currentAnswer === opt.id}
                onChange={() => onAnswer(opt.id)}
                className="h-4 w-4"
              />
              <span className="text-sm">{opt.text}</span>
            </label>
          ))}
        </div>
      );

    case "MSQ":
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Select all that apply:</p>
          {question.options?.map((opt) => {
            const selected = Array.isArray(currentAnswer) ? currentAnswer.includes(opt.id) : false;
            return (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                  selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const current = Array.isArray(currentAnswer) ? [...currentAnswer] : [];
                    if (selected) {
                      onAnswer(current.filter((id) => id !== opt.id));
                    } else {
                      onAnswer([...current, opt.id]);
                    }
                  }}
                  className="h-4 w-4"
                />
                <span className="text-sm">{opt.text}</span>
              </label>
            );
          })}
        </div>
      );

    case "TRUE_FALSE":
      return (
        <div className="flex gap-4">
          {["true", "false"].map((val) => (
            <label
              key={val}
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-6 py-3 transition-colors ${
                currentAnswer === val ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name={`q-${question.questionId}`}
                checked={currentAnswer === val}
                onChange={() => onAnswer(val)}
                className="h-4 w-4"
              />
              <span className="text-sm capitalize">{val}</span>
            </label>
          ))}
        </div>
      );

    case "FILL_BLANK":
      return (
        <div className="space-y-3">
          {Array.from({ length: question.blanksCount || 1 }).map((_, i) => {
            const blanks = Array.isArray(currentAnswer) ? currentAnswer : [];
            return (
              <div key={i} className="flex items-center gap-2">
                <Label className="w-20 text-sm text-muted-foreground">Blank {i + 1}:</Label>
                <Input
                  value={blanks[i] || ""}
                  onChange={(e) => {
                    const updated = [...blanks];
                    updated[i] = e.target.value;
                    onAnswer(updated);
                  }}
                  placeholder="Your answer"
                  className="flex-1"
                />
              </div>
            );
          })}
        </div>
      );

    case "NUMERICAL":
      return (
        <div className="flex max-w-xs items-center gap-2">
          <Input
            type="number"
            value={currentAnswer != null ? String(currentAnswer) : ""}
            onChange={(e) => onAnswer(e.target.value ? Number(e.target.value) : null)}
            placeholder="Enter your answer"
          />
          {question.unit && (
            <span className="text-sm font-medium text-muted-foreground">{question.unit}</span>
          )}
        </div>
      );

    case "SHORT_ANSWER":
      return (
        <textarea
          value={typeof currentAnswer === "string" ? currentAnswer : ""}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Type your answer..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      );

    case "LONG_ANSWER":
      return (
        <textarea
          value={typeof currentAnswer === "string" ? currentAnswer : ""}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Type your detailed answer..."
          rows={8}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      );

    default:
      return <p className="text-sm text-muted-foreground">Unsupported question type</p>;
  }
}
