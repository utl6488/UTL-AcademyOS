import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useGradingAttempt, useGradingAttemptList } from "../api/queries";
import { useSubmitGradesMutation } from "../api/mutations";
import type { GradeInput } from "../schemas/grading-schemas";

export default function GradingViewerPage() {
  const { examId } = useParams<{ examId: string }>();
  const { data: attemptList, isLoading: listLoading } = useGradingAttemptList(examId!);

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentAttemptId = attemptList?.[currentIndex]?.attemptId || "";

  const { data: attempt, isLoading, isError, refetch } = useGradingAttempt(currentAttemptId);
  const submitMutation = useSubmitGradesMutation();

  const [grades, setGrades] = useState<Map<string, GradeInput>>(new Map());

  // Reset grades when attempt changes
  useEffect(() => {
    if (attempt) {
      const initial = new Map<string, GradeInput>();
      attempt.questions.forEach((q) => {
        initial.set(q.questionId, {
          questionId: q.questionId,
          marks: q.scoredMarks ?? 0,
          feedback: q.feedback || "",
        });
      });
      setGrades(initial);
    }
  }, [attempt]);

  function updateGrade(questionId: string, field: "marks" | "feedback", value: string | number) {
    setGrades((prev) => {
      const updated = new Map(prev);
      const existing = updated.get(questionId) || { questionId, marks: 0, feedback: "" };
      updated.set(questionId, { ...existing, [field]: value });
      return updated;
    });
  }

  function handleSave() {
    if (!currentAttemptId) return;
    submitMutation.mutate({
      attemptId: currentAttemptId,
      grades: Array.from(grades.values()),
    });
  }

  function goNext() {
    if (attemptList && currentIndex < attemptList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  if (listLoading || isLoading) return <LoadingSkeleton variant="form" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!attempt) return <LoadingSkeleton variant="form" />;

  const totalScored = Array.from(grades.values()).reduce((s, g) => s + g.marks, 0);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Grading", href: "/grading" }, { label: "Review" }]} />

      <PageHeader
        title="Grade Answers"
        description={`${attempt.studentName} — ${attemptList?.length || 0} attempts`}
        actions={
          <Button onClick={handleSave} loading={submitMutation.isPending}>
            <Save className="mr-2 h-4 w-4" /> Save Grades
          </Button>
        }
      />

      {/* Student info + navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {attempt.studentAvatar ? (
            <img
              src={attempt.studentAvatar}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {attempt.studentName
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
          )}
          <div>
            <p className="font-medium">{attempt.studentName}</p>
            <p className="text-sm text-muted-foreground">
              Score: {totalScored} / {attempt.totalMarks}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} disabled={currentIndex === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} of {attemptList?.length || 0}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={currentIndex === (attemptList?.length || 0) - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {attempt.questions.map((q, index) => {
          const grade = grades.get(q.questionId);
          return (
            <Card key={q.questionId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Q{index + 1}.{" "}
                    <Badge variant="outline" className="ml-2 text-xs">
                      {q.questionType.replace("_", " ")}
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {q.isAutoGraded && (
                      <Badge variant="secondary" className="text-xs">
                        Auto-graded
                      </Badge>
                    )}
                    <Badge
                      variant={q.scoredMarks != null ? "success" : "warning"}
                      className="text-xs"
                    >
                      {q.scoredMarks != null ? (
                        <>
                          <Check className="mr-0.5 h-3 w-3" /> Graded
                        </>
                      ) : (
                        "Pending"
                      )}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Question text */}
                <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                  {q.questionText}
                </div>

                {/* Student answer */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Student's Answer</Label>
                  <div className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
                    {formatAnswer(q.studentAnswer)}
                  </div>
                </div>

                {/* Model answer */}
                {q.modelAnswer != null && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Model Answer</Label>
                    <div className="whitespace-pre-wrap rounded-md border bg-success/5 p-3 text-sm">
                      {formatAnswer(q.modelAnswer)}
                    </div>
                  </div>
                )}

                {/* Rubric */}
                {q.rubric && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Rubric</Label>
                    <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                      {q.rubric}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Grading input */}
                <div className="flex items-end gap-4">
                  <div className="space-y-1">
                    <Label htmlFor={`marks-${q.questionId}`} className="text-xs">
                      Marks (max {q.maxMarks})
                    </Label>
                    <Input
                      id={`marks-${q.questionId}`}
                      type="number"
                      min={0}
                      max={q.maxMarks}
                      step={0.5}
                      value={grade?.marks ?? 0}
                      onChange={(e) => updateGrade(q.questionId, "marks", Number(e.target.value))}
                      className="w-24"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`feedback-${q.questionId}`} className="text-xs">
                      Feedback (optional)
                    </Label>
                    <Input
                      id={`feedback-${q.questionId}`}
                      placeholder="Add feedback for student..."
                      value={grade?.feedback || ""}
                      onChange={(e) => updateGrade(q.questionId, "feedback", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function formatAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) return "No answer provided";
  if (typeof answer === "string") return answer;
  if (typeof answer === "boolean") return answer ? "True" : "False";
  if (typeof answer === "number") return String(answer);
  if (Array.isArray(answer)) return answer.join(", ");
  return JSON.stringify(answer);
}
