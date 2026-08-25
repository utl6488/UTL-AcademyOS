import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useExamDetail } from "../api/queries";
import {
  useCreateExamMutation,
  useUpdateExamMutation,
  usePublishExamMutation,
} from "../api/mutations";
import {
  examDetailsStepSchema,
  proctoringConfigSchema,
  type ExamDetailsStepValues,
  type ExamSection,
  type ProctoringConfig,
  type ExamScheduleStepValues,
} from "../schemas/exam-schemas";
import { cn } from "@/lib/utils";
import { QuestionPickerDialog } from "../components/QuestionPickerDialog";

type WizardStep = "details" | "sections" | "questions" | "schedule" | "proctoring" | "review";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "sections", label: "Sections" },
  { key: "questions", label: "Questions" },
  { key: "schedule", label: "Schedule & Mode" },
  { key: "proctoring", label: "Proctoring" },
  { key: "review", label: "Review & Publish" },
];

export default function ExamBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { data: examDetail, isLoading } = useExamDetail(id || "");
  const createMutation = useCreateExamMutation();
  const updateMutation = useUpdateExamMutation();
  const publishMutation = usePublishExamMutation();

  const [currentStep, setCurrentStep] = useState<WizardStep>("details");
  const [sections, setSections] = useState<ExamSection[]>([
    { id: crypto.randomUUID(), title: "Section 1", durationMinutes: null, questions: [] },
  ]);
  const [schedule, setSchedule] = useState<ExamScheduleStepValues>({
    mode: "FLEXIBLE",
    assignedClasses: [],
    assignedBatches: [],
    assignedStudents: [],
    lateEntryGraceMs: 0,
    lockdownOnLate: false,
  });
  const [proctoring, setProctoring] = useState<ProctoringConfig>(proctoringConfigSchema.parse({}));

  const detailsForm = useForm<ExamDetailsStepValues>({
    resolver: zodResolver(examDetailsStepSchema),
    defaultValues: {
      title: examDetail?.title || "",
      instructions: examDetail?.instructions || "",
      durationMinutes: examDetail?.durationMinutes || 60,
      totalMarks: examDetail?.totalMarks || 100,
      negativeMarking: examDetail?.negativeMarking || 0,
      shuffleQuestions: examDetail?.shuffleQuestions || false,
      shuffleOptions: examDetail?.shuffleOptions || false,
    },
  });

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  function goNext() {
    const nextIndex = Math.min(currentStepIndex + 1, STEPS.length - 1);
    setCurrentStep(STEPS[nextIndex].key);
  }

  function goPrev() {
    const prevIndex = Math.max(currentStepIndex - 1, 0);
    setCurrentStep(STEPS[prevIndex].key);
  }

  // `<input type="datetime-local">` returns `YYYY-MM-DDTHH:mm` (no seconds, no tz).
  // Backend Zod schema requires ISO 8601 with offset — convert here.
  function toIso(v?: string | null): string | undefined {
    if (!v) return undefined;
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  function buildPayload() {
    const details = detailsForm.getValues();
    return {
      ...details,
      sections,
      ...schedule,
      startAt: toIso(schedule.startAt),
      endAt: toIso(schedule.endAt),
      proctoring,
    };
  }

  async function handlePublish() {
    const payload = buildPayload();

    if (isEditing && id) {
      await updateMutation.mutateAsync({ id, ...payload });
      await publishMutation.mutateAsync(id);
    } else {
      const exam = await createMutation.mutateAsync(payload);
      if (exam && "id" in exam) {
        await publishMutation.mutateAsync((exam as { id: string }).id);
      }
    }
    navigate("/exams");
  }

  async function handleSaveDraft() {
    const payload = buildPayload();

    if (isEditing && id) {
      await updateMutation.mutateAsync({ id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    navigate("/exams");
  }

  if (isEditing && isLoading) return <LoadingSkeleton variant="form" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? "Edit Exam" : "Create Exam"}
        description="Build your exam step by step"
        actions={
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            Save Draft
          </Button>
        }
      />

      {/* Step Indicator */}
      <nav className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((step, index) => (
          <button
            key={step.key}
            type="button"
            onClick={() => setCurrentStep(step.key)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              currentStep === step.key
                ? "bg-primary text-primary-foreground"
                : index < currentStepIndex
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {index < currentStepIndex && <Check className="h-3 w-3" />}
            <span>{step.label}</span>
          </button>
        ))}
      </nav>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === "details" && <DetailsStep form={detailsForm} />}
        {currentStep === "sections" && <SectionsStep sections={sections} onChange={setSections} />}
        {currentStep === "questions" && (
          <QuestionsStep sections={sections} onChange={setSections} />
        )}
        {currentStep === "schedule" && <ScheduleStep value={schedule} onChange={setSchedule} />}
        {currentStep === "proctoring" && (
          <ProctoringStep value={proctoring} onChange={setProctoring} />
        )}
        {currentStep === "review" && (
          <ReviewStep
            details={detailsForm.getValues()}
            sections={sections}
            schedule={schedule}
            proctoring={proctoring}
            onPublish={handlePublish}
            isPublishing={publishMutation.isPending}
          />
        )}
      </div>

      {/* Navigation */}
      <Separator />
      <div className="flex justify-between">
        <Button variant="outline" onClick={goPrev} disabled={currentStepIndex === 0}>
          Previous
        </Button>
        {currentStep !== "review" ? <Button onClick={goNext}>Next</Button> : null}
      </div>
    </div>
  );
}

// ─── Step 1: Details ────────────────────────────────────────────────────────

function DetailsStep({ form }: { form: ReturnType<typeof useForm<ExamDetailsStepValues>> }) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Exam Details</CardTitle>
        <CardDescription>Basic information about your exam</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" placeholder="e.g. Mid-Term Mathematics Exam" {...register("title")} />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="instructions">Instructions</Label>
          <textarea
            id="instructions"
            placeholder="Instructions shown before exam starts..."
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register("instructions")}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (min) *</Label>
            <Input id="duration" type="number" min={1} {...register("durationMinutes")} />
            {errors.durationMinutes && (
              <p className="text-xs text-destructive">{errors.durationMinutes.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="marks">Total Marks *</Label>
            <Input id="marks" type="number" min={1} {...register("totalMarks")} />
            {errors.totalMarks && (
              <p className="text-xs text-destructive">{errors.totalMarks.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="negative">Negative Marking (%)</Label>
            <Input id="negative" type="number" min={0} max={100} {...register("negativeMarking")} />
          </div>
        </div>
        <div className="flex gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={watch("shuffleQuestions")}
              onChange={(e) => setValue("shuffleQuestions", e.target.checked)}
              className="rounded"
            />
            Shuffle questions
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={watch("shuffleOptions")}
              onChange={(e) => setValue("shuffleOptions", e.target.checked)}
              className="rounded"
            />
            Shuffle options
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 2: Sections ───────────────────────────────────────────────────────

function SectionsStep({
  sections,
  onChange,
}: {
  sections: ExamSection[];
  onChange: (s: ExamSection[]) => void;
}) {
  function addSection() {
    onChange([
      ...sections,
      {
        id: crypto.randomUUID(),
        title: `Section ${sections.length + 1}`,
        durationMinutes: null,
        questions: [],
      },
    ]);
  }

  function updateSection(index: number, partial: Partial<ExamSection>) {
    const updated = [...sections];
    updated[index] = { ...updated[index], ...partial };
    onChange(updated);
  }

  function removeSection(index: number) {
    if (sections.length <= 1) return;
    onChange(sections.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Sections</CardTitle>
        <CardDescription>
          Divide your exam into sections (optional per-section time limits)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map((section, index) => (
          <div key={section.id} className="flex items-center gap-3 rounded-md border p-3">
            <Input
              value={section.title}
              onChange={(e) => updateSection(index, { title: e.target.value })}
              className="flex-1"
              placeholder="Section title"
            />
            <Input
              type="number"
              placeholder="Duration (min)"
              value={section.durationMinutes || ""}
              onChange={(e) =>
                updateSection(index, {
                  durationMinutes: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-32"
            />
            <Badge variant="secondary">{section.questions.length} Q</Badge>
            {sections.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => removeSection(index)}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" onClick={addSection}>
          Add Section
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Step 3: Questions ──────────────────────────────────────────────────────

function QuestionsStep({
  sections,
  onChange,
}: {
  sections: ExamSection[];
  onChange: (s: ExamSection[]) => void;
}) {
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  function removeQuestion(sIndex: number, questionId: string) {
    const updated = [...sections];
    updated[sIndex] = {
      ...updated[sIndex],
      questions: updated[sIndex].questions
        .filter((q) => q.questionId !== questionId)
        .map((q, i) => ({ ...q, order: i })),
    };
    onChange(updated);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Questions</CardTitle>
          <CardDescription>
            Add questions from the question bank to each section. You can reorder and override
            marks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sections.map((section, sIndex) => (
            <div key={section.id} className="space-y-3 rounded-md border p-4">
              <h4 className="font-medium">{section.title}</h4>
              {section.questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No questions added yet</p>
              ) : (
                <div className="space-y-2">
                  {section.questions.map((q, qIndex) => (
                    <div
                      key={q.questionId}
                      className="flex items-center gap-3 rounded bg-muted/50 p-2 text-sm"
                    >
                      <span className="text-muted-foreground">{qIndex + 1}.</span>
                      <span className="flex-1 truncate">{q.questionText || q.questionId}</span>
                      {q.questionType && (
                        <Badge variant="outline" className="text-xs">
                          {q.questionType}
                        </Badge>
                      )}
                      <span className="text-muted-foreground">{q.marks} marks</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeQuestion(sIndex, q.questionId)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setPickerFor(sIndex)}>
                Add Questions from Bank
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <QuestionPickerDialog
        open={pickerFor !== null}
        onOpenChange={(o) => {
          if (!o) setPickerFor(null);
        }}
        excludeIds={
          pickerFor !== null ? sections[pickerFor]?.questions.map((q) => q.questionId) : []
        }
        onConfirm={(picked) => {
          if (pickerFor === null) return;
          const updated = [...sections];
          const existing = updated[pickerFor].questions;
          updated[pickerFor] = {
            ...updated[pickerFor],
            questions: [
              ...existing,
              ...picked.map((p, i) => ({ ...p, order: existing.length + i })),
            ],
          };
          onChange(updated);
          setPickerFor(null);
        }}
      />
    </>
  );
}

// ─── Step 4: Schedule & Mode ────────────────────────────────────────────────

function ScheduleStep({
  value,
  onChange,
}: {
  value: ExamScheduleStepValues;
  onChange: (v: ExamScheduleStepValues) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Schedule & Mode</CardTitle>
        <CardDescription>Configure when and how students take the exam</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode */}
        <div className="space-y-3">
          <Label>Start Mode</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onChange({ ...value, mode: "FLEXIBLE" })}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                value.mode === "FLEXIBLE" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <p className="text-sm font-medium">Flexible Window</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Each student's timer starts when they click Start
              </p>
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...value, mode: "SYNCHRONOUS" })}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                value.mode === "SYNCHRONOUS" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <p className="text-sm font-medium">Synchronous / Live</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Everyone starts and ends at the same time
              </p>
            </button>
          </div>
        </div>

        {/* Date/Time */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startAt">Start Date/Time</Label>
            <DateTimePicker
              id="startAt"
              value={value.startAt || ""}
              onChange={(next) => onChange({ ...value, startAt: next })}
              placeholder="Choose when the exam opens"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endAt">End Date/Time</Label>
            <DateTimePicker
              id="endAt"
              value={value.endAt || ""}
              onChange={(next) => onChange({ ...value, endAt: next })}
              placeholder="Choose when the exam closes"
              min={value.startAt || undefined}
            />
          </div>
        </div>

        {/* Synchronous-only fields */}
        {value.mode === "SYNCHRONOUS" && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <h4 className="text-sm font-semibold">Synchronous Options</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Late Entry Grace Period</Label>
                <Select
                  value={String(value.lateEntryGraceMs)}
                  onValueChange={(v) => onChange({ ...value, lateEntryGraceMs: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">None</SelectItem>
                    <SelectItem value="120000">2 minutes</SelectItem>
                    <SelectItem value="300000">5 minutes</SelectItem>
                    <SelectItem value="600000">10 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="lockdown"
                  checked={value.lockdownOnLate}
                  onChange={(e) => onChange({ ...value, lockdownOnLate: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="lockdown" className="cursor-pointer">
                  Lock out late students
                </Label>
              </div>
            </div>
          </div>
        )}

        {/* Assignments placeholder */}
        <div className="space-y-2">
          <Label>Assign To</Label>
          <p className="text-sm text-muted-foreground">
            Class/batch/student assignment selector (full implementation with multi-select
            dropdowns)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 5: Proctoring ─────────────────────────────────────────────────────

function ProctoringStep({
  value,
  onChange,
}: {
  value: ProctoringConfig;
  onChange: (v: ProctoringConfig) => void;
}) {
  function toggle(key: keyof ProctoringConfig) {
    onChange({ ...value, [key]: !value[key] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Proctoring Settings</CardTitle>
        <CardDescription>Configure anti-cheat measures for this exam</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fullscreen */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Require Fullscreen</p>
              <p className="text-xs text-muted-foreground">Students must be in fullscreen mode</p>
            </div>
            <input
              type="checkbox"
              checked={value.requireFullscreen}
              onChange={() => toggle("requireFullscreen")}
              className="rounded"
            />
          </div>
          {value.requireFullscreen && (
            <div className="ml-4 space-y-2">
              <Label>Fullscreen Exit Policy</Label>
              <Select
                value={value.fullscreenExitPolicy}
                onValueChange={(v) =>
                  onChange({
                    ...value,
                    fullscreenExitPolicy: v as typeof value.fullscreenExitPolicy,
                  })
                }
              >
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flag_only">Flag only</SelectItem>
                  <SelectItem value="warn_then_submit">Warn (N times), then auto-submit</SelectItem>
                  <SelectItem value="auto_submit">Auto-submit immediately</SelectItem>
                </SelectContent>
              </Select>
              {value.fullscreenExitPolicy === "warn_then_submit" && (
                <div className="flex items-center gap-2">
                  <Label>Max warnings:</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className="w-20"
                    value={value.fullscreenMaxWarnings}
                    onChange={(e) =>
                      onChange({ ...value, fullscreenMaxWarnings: Number(e.target.value) })
                    }
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Tab Switch */}
        <div className="space-y-3">
          <Label>Tab Switch Policy</Label>
          <Select
            value={value.tabSwitchPolicy}
            onValueChange={(v) =>
              onChange({ ...value, tabSwitchPolicy: v as typeof value.tabSwitchPolicy })
            }
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flag_only">Flag only</SelectItem>
              <SelectItem value="warn_then_submit">Warn (N times), then auto-submit</SelectItem>
              <SelectItem value="auto_submit">Auto-submit immediately</SelectItem>
            </SelectContent>
          </Select>
          {value.tabSwitchPolicy === "warn_then_submit" && (
            <div className="flex items-center gap-2">
              <Label>Max warnings:</Label>
              <Input
                type="number"
                min={1}
                max={10}
                className="w-20"
                value={value.tabSwitchMaxWarnings}
                onChange={(e) =>
                  onChange({ ...value, tabSwitchMaxWarnings: Number(e.target.value) })
                }
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Disable Actions */}
        <div className="space-y-3">
          <Label>Disable Actions</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { key: "disableCopy" as const, label: "Copy" },
              { key: "disablePaste" as const, label: "Paste" },
              { key: "disableRightClick" as const, label: "Right Click" },
              { key: "disablePrint" as const, label: "Print" },
              { key: "disableDevtools" as const, label: "DevTools" },
            ].map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value[key]}
                  onChange={() => toggle(key)}
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <Separator />

        {/* Advanced */}
        <div className="space-y-3">
          <Label>Advanced (Plan-gated)</Label>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.blockMultipleDisplays}
                onChange={() => toggle("blockMultipleDisplays")}
                className="rounded"
              />
              Block Multiple Displays (Chromium only)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.requireSecureBrowser}
                onChange={() => toggle("requireSecureBrowser")}
                className="rounded"
              />
              Require UTL Secure Browser (Pro+)
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 6: Review ─────────────────────────────────────────────────────────

function ReviewStep({
  details,
  sections,
  schedule,
  proctoring,
  onPublish,
  isPublishing,
}: {
  details: ExamDetailsStepValues;
  sections: ExamSection[];
  schedule: ExamScheduleStepValues;
  proctoring: ProctoringConfig;
  onPublish: () => void;
  isPublishing: boolean;
}) {
  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Review & Publish</CardTitle>
        <CardDescription>Verify all settings before publishing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryItem label="Title" value={details.title} />
          <SummaryItem label="Duration" value={`${details.durationMinutes} min`} />
          <SummaryItem label="Total Marks" value={String(details.totalMarks)} />
          <SummaryItem label="Questions" value={String(totalQuestions)} />
          <SummaryItem label="Sections" value={String(sections.length)} />
          <SummaryItem
            label="Mode"
            value={schedule.mode === "SYNCHRONOUS" ? "Live / Synchronous" : "Flexible Window"}
          />
          <SummaryItem
            label="Negative Marking"
            value={details.negativeMarking > 0 ? `${details.negativeMarking}%` : "None"}
          />
          <SummaryItem
            label="Proctoring"
            value={proctoring.requireFullscreen ? "Enabled" : "Minimal"}
          />
        </div>

        <Separator />

        {/* Validation Warnings */}
        <div className="space-y-2">
          {totalQuestions === 0 && (
            <p className="flex items-center gap-2 text-sm text-warning">
              ⚠️ No questions added. The exam cannot be published without questions.
            </p>
          )}
          {schedule.mode === "SYNCHRONOUS" && !schedule.startAt && (
            <p className="flex items-center gap-2 text-sm text-warning">
              ⚠️ Synchronous exams require a start time.
            </p>
          )}
          {totalQuestions > 0 && (schedule.mode !== "SYNCHRONOUS" || schedule.startAt) && (
            <p className="flex items-center gap-2 text-sm text-success">
              ✓ All validations passed. Ready to publish.
            </p>
          )}
        </div>

        <Button
          onClick={onPublish}
          loading={isPublishing}
          disabled={totalQuestions === 0 || (schedule.mode === "SYNCHRONOUS" && !schedule.startAt)}
          className="w-full"
        >
          Publish Exam
        </Button>
      </CardContent>
    </Card>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
