import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { QuestionFormValues, McqOption } from "../schemas/question-schemas";

interface QuestionPreviewProps {
  data: QuestionFormValues;
}

export function QuestionPreview({ data }: QuestionPreviewProps) {
  return (
    <div className="space-y-4">
      {/* Question Text */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{data.type.replace("_", " ")}</Badge>
          <Badge variant="outline">
            {data.marks} mark{data.marks !== 1 ? "s" : ""}
          </Badge>
        </div>
        <p className="whitespace-pre-wrap text-base font-medium leading-relaxed">
          {renderQuestionText(data)}
        </p>
      </div>

      <Separator />

      {/* Type-specific preview */}
      <TypePreview data={data} />
    </div>
  );
}

function renderQuestionText(data: QuestionFormValues): string {
  if (data.type === "FILL_BLANK") {
    // Replace [blank] markers with underline placeholders
    return data.text.replace(/\[blank\]/g, "________");
  }
  return data.text || "No question text entered yet.";
}

function TypePreview({ data }: { data: QuestionFormValues }) {
  switch (data.type) {
    case "MCQ":
      return <MCQPreview options={data.options} multiple={false} />;
    case "MSQ":
      return <MCQPreview options={data.options} multiple={true} />;
    case "TRUE_FALSE":
      return <TrueFalsePreview />;
    case "FILL_BLANK":
      return <FillBlankPreview blanksCount={data.blanks.length} />;
    case "NUMERICAL":
      return <NumericalPreview unit={data.unit} />;
    case "SHORT_ANSWER":
      return <TextAnswerPreview label="Short answer" rows={2} />;
    case "LONG_ANSWER":
      return <TextAnswerPreview label="Long answer" rows={5} />;
    case "IMAGE_BASED":
      return <ImageBasedPreview imageUrl={data.imageUrl} options={data.options} />;
    default:
      return null;
  }
}

function MCQPreview({ options, multiple }: { options: McqOption[]; multiple: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {multiple ? "Select all that apply:" : "Select one:"}
      </p>
      {options.map((option, index) => (
        <label
          key={option.id || index}
          className="flex cursor-pointer items-center gap-3 rounded-md border p-2.5 transition-colors hover:bg-muted/50"
        >
          <input
            type={multiple ? "checkbox" : "radio"}
            name="preview-option"
            disabled
            className="h-4 w-4"
          />
          <span className="text-sm">{option.text || `Option ${index + 1}`}</span>
        </label>
      ))}
    </div>
  );
}

function TrueFalsePreview() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Select one:</p>
      <label className="flex cursor-pointer items-center gap-3 rounded-md border p-2.5 hover:bg-muted/50">
        <input type="radio" name="preview-tf" disabled className="h-4 w-4" />
        <span className="text-sm">True</span>
      </label>
      <label className="flex cursor-pointer items-center gap-3 rounded-md border p-2.5 hover:bg-muted/50">
        <input type="radio" name="preview-tf" disabled className="h-4 w-4" />
        <span className="text-sm">False</span>
      </label>
    </div>
  );
}

function FillBlankPreview({ blanksCount }: { blanksCount: number }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Fill in the blank{blanksCount > 1 ? "s" : ""}:
      </p>
      {Array.from({ length: blanksCount }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Blank {i + 1}:</span>
          <div className="flex h-9 flex-1 items-center rounded-md border bg-muted/30 px-3">
            <span className="text-sm italic text-muted-foreground">Type your answer...</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function NumericalPreview({ unit }: { unit?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Enter a numerical value:</p>
      <div className="flex items-center gap-2">
        <div className="flex h-9 flex-1 items-center rounded-md border bg-muted/30 px-3">
          <span className="text-sm italic text-muted-foreground">Enter number...</span>
        </div>
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function TextAnswerPreview({ label, rows }: { label: string; rows: number }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}:</p>
      <div
        className="flex w-full items-start rounded-md border bg-muted/30 px-3 py-2"
        style={{ minHeight: `${rows * 1.5 + 1}rem` }}
      >
        <span className="text-sm italic text-muted-foreground">Type your answer here...</span>
      </div>
    </div>
  );
}

function ImageBasedPreview({ imageUrl, options }: { imageUrl: string; options: McqOption[] }) {
  return (
    <div className="space-y-3">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Question image"
          className="max-h-64 max-w-full rounded-md border object-contain"
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed bg-muted/30">
          <span className="text-sm text-muted-foreground">Image preview</span>
        </div>
      )}
      <MCQPreview options={options} multiple={false} />
    </div>
  );
}
