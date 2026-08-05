import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles, Check, X, FileText, BookOpen, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { useGenerateQuestionsMutation, useGenerateExamMutation } from "../api/mutations";
import { useClassSummary, useHomeworkRecommendation } from "../api/queries";
import { useExams } from "@/features/exam-authoring/api/queries";
import {
  generateQuestionsRequestSchema,
  type GenerateQuestionsRequest,
  type GeneratedQuestion,
} from "../schemas/ai-schemas";

export default function TeacherAiPage() {
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [acceptedQuestions, setAcceptedQuestions] = useState<Set<number>>(new Set());
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [homeworkClassId, setHomeworkClassId] = useState<string>("");
  const [homeworkCount, setHomeworkCount] = useState<number>(10);

  const generateQuestionsMutation = useGenerateQuestionsMutation();
  const generateExamMutation = useGenerateExamMutation();

  const examsQuery = useExams({ status: "completed", page: 1, pageSize: 25 });
  const classSummaryQuery = useClassSummary(selectedExamId || undefined);
  const homeworkQuery = useHomeworkRecommendation(
    { classId: homeworkClassId, count: homeworkCount },
    { enabled: Boolean(homeworkClassId) }
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GenerateQuestionsRequest>({
    resolver: zodResolver(generateQuestionsRequestSchema),
    defaultValues: {
      topic: "",
      difficulty: "medium",
      type: "MCQ",
      count: 5,
    },
  });

  const onGenerateQuestions = async (data: GenerateQuestionsRequest) => {
    const result = await generateQuestionsMutation.mutateAsync(data);
    setGeneratedQuestions(result);
    setAcceptedQuestions(new Set());
  };

  const handleAccept = (index: number) => {
    setAcceptedQuestions((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const handleDiscard = (index: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAcceptAll = () => {
    setAcceptedQuestions(new Set(generatedQuestions.map((_, i) => i)));
  };

  const handleDiscardAll = () => {
    setGeneratedQuestions([]);
    setAcceptedQuestions(new Set());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Tools"
        description="Generate questions and exams using AI"
        actions={
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            AI Credits: Active
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Generate Questions Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Generate Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onGenerateQuestions)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g. Photosynthesis, Quadratic Equations"
                  {...register("topic")}
                />
                {errors.topic && <p className="text-sm text-destructive">{errors.topic.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select
                    value={watch("difficulty")}
                    onValueChange={(v) => setValue("difficulty", v as "easy" | "medium" | "hard")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={watch("type")} onValueChange={(v) => setValue("type", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MCQ">MCQ</SelectItem>
                      <SelectItem value="MSQ">MSQ</SelectItem>
                      <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                      <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                      <SelectItem value="LONG_ANSWER">Long Answer</SelectItem>
                      <SelectItem value="NUMERICAL">Numerical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="count">Count</Label>
                <Input id="count" type="number" min={1} max={20} {...register("count")} />
                {errors.count && <p className="text-sm text-destructive">{errors.count.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={generateQuestionsMutation.isPending}
              >
                {generateQuestionsMutation.isPending ? (
                  "Generating..."
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Questions
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Generate Exam */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Generate Exam from Blueprint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Automatically create an exam from your exam blueprint configuration. AI will select or
              generate questions matching your difficulty distribution and topic coverage.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                generateExamMutation.mutate({
                  subjectId: "",
                  totalMarks: 100,
                  duration: 180,
                  difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
                })
              }
              disabled={generateExamMutation.isPending}
            >
              {generateExamMutation.isPending ? (
                "Generating..."
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Exam
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Class Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4" />
            Class Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Exam</Label>
            <Select value={selectedExamId} onValueChange={setSelectedExamId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a completed exam..." />
              </SelectTrigger>
              <SelectContent>
                {examsQuery.data?.data.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedExamId && classSummaryQuery.isLoading && <LoadingSkeleton variant="card" />}
          {classSummaryQuery.isError && (
            <p className="text-sm text-destructive">Failed to load class summary.</p>
          )}
          {classSummaryQuery.data && (
            <div className="space-y-4 rounded-md border p-4">
              <p className="text-sm font-medium">{classSummaryQuery.data.headline}</p>
              <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                <MetricPill
                  label="Attempted"
                  value={`${classSummaryQuery.data.metrics.attemptedStudents}/${classSummaryQuery.data.metrics.totalStudents}`}
                />
                <MetricPill
                  label="Avg score"
                  value={String(classSummaryQuery.data.metrics.averageScore)}
                />
                <MetricPill
                  label="Pass rate"
                  value={`${classSummaryQuery.data.metrics.passRate}%`}
                />
                <MetricPill
                  label="Weak topics"
                  value={String(classSummaryQuery.data.metrics.weakTopics.length)}
                />
              </div>
              <NarrativeBlock title="Highlights" items={classSummaryQuery.data.highlights} />
              <NarrativeBlock title="Concerns" items={classSummaryQuery.data.concerns} />
              <NarrativeBlock
                title="Recommended actions"
                items={classSummaryQuery.data.recommendedActions}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Homework Recommendation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="h-4 w-4" />
            Homework Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="homework-class">Class ID</Label>
              <Input
                id="homework-class"
                placeholder="Paste class ID"
                value={homeworkClassId}
                onChange={(e) => setHomeworkClassId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="homework-count">Question count</Label>
              <Input
                id="homework-count"
                type="number"
                min={1}
                max={50}
                value={homeworkCount}
                onChange={(e) => setHomeworkCount(Number(e.target.value) || 10)}
              />
            </div>
          </div>

          {homeworkClassId && homeworkQuery.isLoading && <LoadingSkeleton variant="card" />}
          {homeworkQuery.isError && (
            <p className="text-sm text-destructive">Failed to load recommendations.</p>
          )}
          {homeworkQuery.data && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Cohort of {homeworkQuery.data.cohortSize} student
                {homeworkQuery.data.cohortSize === 1 ? "" : "s"} ·{" "}
                {homeworkQuery.data.topWeakTopics.length} weak topic
                {homeworkQuery.data.topWeakTopics.length === 1 ? "" : "s"} identified.
              </p>
              {homeworkQuery.data.topWeakTopics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {homeworkQuery.data.topWeakTopics.map((t) => (
                    <Badge key={t.topic} variant="outline">
                      {t.topic} · {t.averageAccuracy}% ({t.affectedStudents} students)
                    </Badge>
                  ))}
                </div>
              )}
              {homeworkQuery.data.questions.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  No matching questions in the bank yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {homeworkQuery.data.questions.map((q) => (
                    <div key={q.id} className="rounded-md border p-3">
                      <p className="text-sm">{q.text}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">{q.difficulty}</Badge>
                        {q.topic && <Badge variant="outline">{q.topic}</Badge>}
                        <Badge variant="outline">{q.marks} marks</Badge>
                      </div>
                      <p className="mt-2 text-xs italic text-muted-foreground">{q.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated Questions Preview */}
      {generateQuestionsMutation.isPending && <LoadingSkeleton variant="card" />}

      {generatedQuestions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Generated Questions ({generatedQuestions.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleAcceptAll}>
                <Check className="mr-1 h-4 w-4" /> Accept All
              </Button>
              <Button variant="outline" size="sm" onClick={handleDiscardAll}>
                <X className="mr-1 h-4 w-4" /> Discard All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {generatedQuestions.map((question, index) => (
                <div
                  key={index}
                  className={cn(
                    "rounded-md border p-4",
                    acceptedQuestions.has(index) &&
                      "border-green-500 bg-green-50 dark:bg-green-950/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium">{question.text}</p>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{question.type}</Badge>
                        <Badge variant="outline">{question.difficulty}</Badge>
                        {question.marks && <Badge variant="outline">{question.marks} marks</Badge>}
                      </div>
                      {question.options && (
                        <ul className="mt-2 space-y-1">
                          {question.options.map((opt) => (
                            <li
                              key={opt.id}
                              className={cn(
                                "rounded px-2 py-1 text-xs",
                                opt.isCorrect ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"
                              )}
                            >
                              {opt.text}
                              {opt.isCorrect && " ✓"}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {!acceptedQuestions.has(index) && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAccept(index)}
                            aria-label="Accept question"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDiscard(index)}
                            aria-label="Discard question"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}
                      {acceptedQuestions.has(index) && <Badge variant="success">Accepted</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function NarrativeBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
