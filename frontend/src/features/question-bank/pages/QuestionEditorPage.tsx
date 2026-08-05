import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Eye, EyeOff, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { FormTextarea } from "@/components/forms/form-textarea";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { useQuestionDetail } from "../api/queries";
import { useCreateQuestionMutation, useUpdateQuestionMutation } from "../api/mutations";
import { useSubjects, useTopics } from "@/features/org/api/queries";
import { QuestionPreview } from "../components/QuestionPreview";
import {
  questionFormSchema,
  QuestionType,
  type QuestionFormValues,
  type McqOption,
} from "../schemas/question-schemas";

const QUESTION_TYPE_LABELS: Record<string, string> = {
  MCQ: "Multiple Choice (Single)",
  MSQ: "Multiple Choice (Multiple)",
  TRUE_FALSE: "True / False",
  FILL_BLANK: "Fill in the Blank",
  NUMERICAL: "Numerical",
  SHORT_ANSWER: "Short Answer",
  LONG_ANSWER: "Long Answer",
  IMAGE_BASED: "Image Based",
};

function generateOptionId() {
  return crypto.randomUUID();
}

export default function QuestionEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [showPreview, setShowPreview] = useState(false);
  const [selectedType, setSelectedType] = useState<QuestionFormValues["type"]>("MCQ");

  const { data: questionDetail, isLoading } = useQuestionDetail(id || "");
  const { data: subjects } = useSubjects();
  const createMutation = useCreateQuestionMutation();
  const updateMutation = useUpdateQuestionMutation();

  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      type: "MCQ",
      subjectId: "",
      topicId: "",
      difficulty: "medium",
      marks: 1,
      tags: [],
      text: "",
      explanation: "",
      options: [
        { id: generateOptionId(), text: "", isCorrect: false },
        { id: generateOptionId(), text: "", isCorrect: false },
      ],
    } as QuestionFormValues,
  });

  const watchedSubjectId = form.watch("subjectId");
  const { data: topics } = useTopics(watchedSubjectId || "");

  // Populate form when editing
  useEffect(() => {
    if (questionDetail && isEditing) {
      setSelectedType(questionDetail.type);
      const formValues = mapDetailToFormValues(questionDetail);
      form.reset(formValues);
    }
  }, [questionDetail, isEditing, form]);

  const onSubmit = async (values: QuestionFormValues) => {
    if (isEditing && id) {
      await updateMutation.mutateAsync({ id, ...values });
    } else {
      await createMutation.mutateAsync(values);
    }
    navigate("/questions");
  };

  const handleTypeChange = (type: QuestionFormValues["type"]) => {
    setSelectedType(type);
    const current = form.getValues();
    const base = {
      subjectId: current.subjectId,
      topicId: current.topicId || "",
      difficulty: current.difficulty,
      marks: current.marks,
      tags: current.tags,
      text: current.text,
      explanation: current.explanation || "",
    };

    let resetValues: QuestionFormValues;
    switch (type) {
      case "MCQ":
      case "MSQ":
        resetValues = {
          ...base,
          type,
          options: [
            { id: generateOptionId(), text: "", isCorrect: false },
            { id: generateOptionId(), text: "", isCorrect: false },
          ],
        };
        break;
      case "TRUE_FALSE":
        resetValues = { ...base, type, correctAnswer: true };
        break;
      case "FILL_BLANK":
        resetValues = { ...base, type, blanks: [""] };
        break;
      case "NUMERICAL":
        resetValues = { ...base, type, correctAnswer: 0, tolerance: 0, unit: "" };
        break;
      case "SHORT_ANSWER":
      case "LONG_ANSWER":
        resetValues = { ...base, type, modelAnswer: "", rubric: "" };
        break;
      case "IMAGE_BASED":
        resetValues = {
          ...base,
          type,
          imageUrl: "",
          options: [
            { id: generateOptionId(), text: "", isCorrect: false },
            { id: generateOptionId(), text: "", isCorrect: false },
          ],
        };
        break;
    }
    form.reset(resetValues);
  };

  if (isEditing && isLoading) return <LoadingSkeleton variant="form" />;

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? "Edit Question" : "Create Question"}
        description="Fill in the details below"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? (
                <>
                  <EyeOff className="mr-2 h-4 w-4" /> Hide Preview
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" /> Preview
                </>
              )}
            </Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={isPending}>
              <Save className="mr-2 h-4 w-4" />
              {isPending ? "Saving..." : "Save Question"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Type Selector */}
          <div className="space-y-2">
            <Label>Question Type</Label>
            <div className="flex flex-wrap gap-2">
              {QuestionType.options.map((type) => (
                <Badge
                  key={type}
                  variant={selectedType === type ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1.5 text-sm"
                  onClick={() => handleTypeChange(type)}
                >
                  {QUESTION_TYPE_LABELS[type]}
                </Badge>
              ))}
            </div>
          </div>

          {/* Common Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subjectId">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("subjectId")}
                onValueChange={(v) => {
                  form.setValue("subjectId", v);
                  form.setValue("topicId", "");
                }}
              >
                <SelectTrigger id="subjectId">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.subjectId && (
                <p className="text-xs text-destructive" role="alert">
                  {form.formState.errors.subjectId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="topicId">Topic</Label>
              <Select
                value={form.watch("topicId") || ""}
                onValueChange={(v) => form.setValue("topicId", v || undefined)}
              >
                <SelectTrigger id="topicId">
                  <SelectValue placeholder="Select topic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {topics?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">
                Difficulty <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("difficulty")}
                onValueChange={(v) => form.setValue("difficulty", v as "easy" | "medium" | "hard")}
              >
                <SelectTrigger id="difficulty">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <FormField form={form} name="marks" label="Marks" type="number" required />
          </div>

          {/* Question Text */}
          <FormTextarea
            form={form}
            name="text"
            label="Question Text"
            placeholder="Enter the question text... (Tiptap editor coming soon)"
            rows={4}
            required
          />

          {/* Tags */}
          <TagsInput form={form} />

          {/* Per-Type Fields */}
          <TypeSpecificFields type={selectedType} form={form} />

          {/* Explanation */}
          <FormTextarea
            form={form}
            name="explanation"
            label="Explanation"
            placeholder="Explanation shown after answering (optional)"
            rows={3}
          />
        </form>

        {/* Preview */}
        {showPreview && (
          <div className="sticky top-6 self-start rounded-lg border bg-muted/30 p-6">
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground">Student Preview</h3>
            <QuestionPreview data={form.watch()} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Type-Specific Field Components ─────────────────────────────────────────

function TypeSpecificFields({
  type,
  form,
}: {
  type: QuestionFormValues["type"];
  form: UseFormReturn<QuestionFormValues>;
}) {
  switch (type) {
    case "MCQ":
    case "MSQ":
      return <OptionsFields form={form} multiple={type === "MSQ"} />;
    case "TRUE_FALSE":
      return <TrueFalseFields form={form} />;
    case "FILL_BLANK":
      return <FillBlankFields form={form} />;
    case "NUMERICAL":
      return <NumericalFields form={form} />;
    case "SHORT_ANSWER":
    case "LONG_ANSWER":
      return <AnswerFields form={form} isLong={type === "LONG_ANSWER"} />;
    case "IMAGE_BASED":
      return <ImageBasedFields form={form} />;
    default:
      return null;
  }
}

function OptionsFields({
  form,
  multiple,
}: {
  form: UseFormReturn<QuestionFormValues>;
  multiple: boolean;
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options" as never,
  });

  const options = form.watch("options" as never) as McqOption[] | undefined;

  const handleCorrectToggle = (index: number) => {
    if (!options) return;
    if (multiple) {
      // Toggle individual for MSQ
      form.setValue(`options.${index}.isCorrect` as never, !options[index].isCorrect as never);
    } else {
      // Radio-like for MCQ - only one correct
      options.forEach((_, i) => {
        form.setValue(`options.${i}.isCorrect` as never, (i === index) as never);
      });
    }
  };

  return (
    <div className="space-y-3">
      <Label>Options {multiple && "(select all correct)"}</Label>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <input
            type={multiple ? "checkbox" : "radio"}
            name="correctOption"
            checked={options?.[index]?.isCorrect || false}
            onChange={() => handleCorrectToggle(index)}
            className="h-4 w-4"
            aria-label={`Mark option ${index + 1} as correct`}
          />
          <Input
            placeholder={`Option ${index + 1}`}
            {...form.register(`options.${index}.text` as never)}
            className="flex-1"
          />
          {fields.length > 2 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              aria-label={`Remove option ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ id: generateOptionId(), text: "", isCorrect: false })}
      >
        <Plus className="mr-1 h-4 w-4" /> Add Option
      </Button>
    </div>
  );
}

function TrueFalseFields({ form }: { form: UseFormReturn<QuestionFormValues> }) {
  const value = form.watch("correctAnswer" as never) as unknown as boolean;
  return (
    <div className="space-y-2">
      <Label>Correct Answer</Label>
      <div className="flex gap-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            checked={value === true}
            onChange={() => form.setValue("correctAnswer" as never, true as never)}
            className="h-4 w-4"
          />
          <span className="text-sm">True</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            checked={value === false}
            onChange={() => form.setValue("correctAnswer" as never, false as never)}
            className="h-4 w-4"
          />
          <span className="text-sm">False</span>
        </label>
      </div>
    </div>
  );
}

function FillBlankFields({ form }: { form: UseFormReturn<QuestionFormValues> }) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "blanks" as never,
  });

  return (
    <div className="space-y-3">
      <Label>Blank Answers</Label>
      <p className="text-xs text-muted-foreground">
        Use [blank] markers in the question text. Provide answers in order.
      </p>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <span className="w-16 text-sm text-muted-foreground">Blank {index + 1}:</span>
          <Input
            placeholder={`Answer for blank ${index + 1}`}
            {...form.register(`blanks.${index}` as never)}
            className="flex-1"
          />
          {fields.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              aria-label={`Remove blank ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => append("" as never)}>
        <Plus className="mr-1 h-4 w-4" /> Add Blank
      </Button>
    </div>
  );
}

function NumericalFields({ form }: { form: UseFormReturn<QuestionFormValues> }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <FormField
        form={form}
        name={"correctAnswer" as never}
        label="Correct Value"
        type="number"
        required
      />
      <FormField form={form} name={"tolerance" as never} label="Tolerance (±)" type="number" />
      <FormField form={form} name={"unit" as never} label="Unit" placeholder="e.g. kg, m/s" />
    </div>
  );
}

function AnswerFields({
  form,
  isLong,
}: {
  form: UseFormReturn<QuestionFormValues>;
  isLong: boolean;
}) {
  return (
    <div className="space-y-4">
      <FormTextarea
        form={form}
        name={"modelAnswer" as never}
        label="Model Answer"
        placeholder="The expected answer..."
        rows={isLong ? 6 : 3}
        required
      />
      <FormTextarea
        form={form}
        name={"rubric" as never}
        label="Grading Rubric"
        placeholder="Rubric for manual grading (optional)"
        rows={3}
      />
    </div>
  );
}

function ImageBasedFields({ form }: { form: UseFormReturn<QuestionFormValues> }) {
  return (
    <div className="space-y-4">
      <FormField
        form={form}
        name={"imageUrl" as never}
        label="Image URL"
        placeholder="Upload or paste image URL"
        required
        description="Image upload component coming soon. Paste a URL for now."
      />
      <OptionsFields form={form} multiple={false} />
    </div>
  );
}

// ─── Tags Input ─────────────────────────────────────────────────────────────

function TagsInput({ form }: { form: UseFormReturn<QuestionFormValues> }) {
  const [input, setInput] = useState("");
  const tags = form.watch("tags") || [];

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      form.setValue("tags", [...tags, trimmed]);
      setInput("");
    }
  };

  const removeTag = (tag: string) => {
    form.setValue(
      "tags",
      tags.filter((t) => t !== tag)
    );
  };

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 hover:text-destructive"
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add a tag..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          className="w-48"
        />
        <Button type="button" variant="outline" size="sm" onClick={addTag}>
          Add
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapDetailToFormValues(
  detail: NonNullable<ReturnType<typeof useQuestionDetail>["data"]>
): QuestionFormValues {
  const base = {
    subjectId: detail.subjectId,
    topicId: detail.topicId || undefined,
    difficulty: detail.difficulty,
    marks: detail.marks,
    tags: detail.tags,
    text: detail.text,
    explanation: detail.explanation || "",
  };

  switch (detail.type) {
    case "MCQ":
    case "MSQ":
      return { ...base, type: detail.type, options: detail.options || [] };
    case "TRUE_FALSE":
      return { ...base, type: "TRUE_FALSE", correctAnswer: detail.correctAnswer as boolean };
    case "FILL_BLANK":
      return { ...base, type: "FILL_BLANK", blanks: detail.blanks || [""] };
    case "NUMERICAL":
      return {
        ...base,
        type: "NUMERICAL",
        correctAnswer: Number(detail.correctAnswer) || 0,
        tolerance: detail.tolerance || 0,
        unit: detail.unit || "",
      };
    case "SHORT_ANSWER":
      return {
        ...base,
        type: "SHORT_ANSWER",
        modelAnswer: (detail.correctAnswer as string) || "",
        rubric: detail.rubric || "",
      };
    case "LONG_ANSWER":
      return {
        ...base,
        type: "LONG_ANSWER",
        modelAnswer: (detail.correctAnswer as string) || "",
        rubric: detail.rubric || "",
      };
    case "IMAGE_BASED":
      return {
        ...base,
        type: "IMAGE_BASED",
        imageUrl: detail.imageUrl || "",
        options: detail.options || [],
      };
  }
}
