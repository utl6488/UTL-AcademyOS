import { useParams } from "react-router-dom";
import { Trophy, Clock, Target, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useStudentResult } from "../api/queries";
import { formatPercent } from "@/lib/format";

export default function StudentResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { data: result, isLoading, isError, refetch } = useStudentResult(attemptId!);

  if (isLoading) return <LoadingSkeleton variant="card" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!result) return null;

  return (
    <div className="space-y-6">
      <PageHeader title={result.examTitle} description="Your exam results" />

      {/* Scorecard */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard icon={Trophy} label="Score" value={`${result.score}/${result.totalMarks}`} />
        <KPICard icon={Target} label="Percentage" value={formatPercent(result.percentage)} />
        <KPICard
          icon={TrendingUp}
          label="Rank"
          value={`${result.rank} of ${result.totalStudents}`}
        />
        <KPICard icon={Clock} label="Time Taken" value={`${result.timeTakenMinutes} min`} />
      </div>

      {/* Percentile badge */}
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">You scored better than</p>
          <p className="text-3xl font-bold text-primary">{formatPercent(result.percentile)}</p>
          <p className="text-sm text-muted-foreground">of students</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="breakdown">
        <TabsList>
          <TabsTrigger value="breakdown">Section Breakdown</TabsTrigger>
          <TabsTrigger value="topics">Topic Analysis</TabsTrigger>
          <TabsTrigger value="time">Time Analysis</TabsTrigger>
          <TabsTrigger value="solutions">Solution Review</TabsTrigger>
        </TabsList>

        {/* Section breakdown */}
        <TabsContent value="breakdown" className="space-y-4">
          {result.sections.map((section) => (
            <Card key={section.title}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{section.title}</h4>
                  <span className="text-sm font-medium">
                    {section.score}/{section.totalMarks}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${section.percentage}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatPercent(section.percentage)}
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Topic accuracy radar */}
        <TabsContent value="topics">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Topic-wise Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={result.topicAccuracy}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="topic" className="text-xs" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar
                      name="Accuracy %"
                      dataKey="accuracy"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time per question */}
        <TabsContent value="time">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Time per Question</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.timePerQuestion}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="questionNumber"
                      label={{ value: "Question", position: "insideBottom", offset: -5 }}
                    />
                    <YAxis label={{ value: "Seconds", angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Bar dataKey="seconds" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Solution review */}
        <TabsContent value="solutions" className="space-y-4">
          {result.questions.map((q, index) => (
            <Card key={q.questionId}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Q{index + 1}</span>
                    {q.isCorrect ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <Badge variant="outline" className="text-xs">
                      {q.questionType.replace("_", " ")}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">
                    {q.scoredMarks}/{q.marks}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{q.questionText}</p>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Your Answer</p>
                    <p className={q.isCorrect ? "text-success" : "text-destructive"}>
                      {formatAnswer(q.studentAnswer)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Correct Answer</p>
                    <p className="text-success">{formatAnswer(q.correctAnswer)}</p>
                  </div>
                </div>
                {q.explanation && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Explanation</p>
                    <p>{q.explanation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) return "—";
  if (typeof answer === "string") return answer;
  if (typeof answer === "boolean") return answer ? "True" : "False";
  if (typeof answer === "number") return String(answer);
  if (Array.isArray(answer)) return answer.join(", ");
  return JSON.stringify(answer);
}
