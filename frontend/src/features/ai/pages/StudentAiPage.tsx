import { Link } from "react-router-dom";
import {
  ThumbsUp,
  ThumbsDown,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useWeakTopics, useStudyPlan, usePredictions } from "../api/queries";
import { useGenerateStudyPlanMutation, useSubmitAiFeedbackMutation } from "../api/mutations";
import { useAuthStore } from "@/store/auth-store";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const TREND_ICONS = {
  improving: TrendingUp,
  declining: TrendingDown,
  stable: Minus,
} as const;

const TREND_COLORS = {
  improving: "text-green-600",
  declining: "text-red-600",
  stable: "text-muted-foreground",
} as const;

export default function StudentAiPage() {
  const studentId = useAuthStore((s) => s.user?.id ?? "");

  const {
    data: weakTopics,
    isLoading: loadingTopics,
    isError: errorTopics,
    refetch: refetchTopics,
  } = useWeakTopics(studentId);
  const {
    data: studyPlan,
    isLoading: loadingPlan,
    isError: errorPlan,
    refetch: refetchPlan,
  } = useStudyPlan(studentId);
  const {
    data: predictions,
    isLoading: loadingPredictions,
    isError: errorPredictions,
    refetch: refetchPredictions,
  } = usePredictions(studentId);

  const generatePlanMutation = useGenerateStudyPlanMutation();
  const feedbackMutation = useSubmitAiFeedbackMutation();

  const handleFeedback = (outputId: string, thumbsUp: boolean) => {
    feedbackMutation.mutate({ outputId, thumbsUp });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Study Assistant"
        description="Personalized insights and recommendations powered by AI"
        actions={
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            AI Credits: Active
          </Badge>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Predicted Score Gauge */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Predicted Score</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPredictions ? (
              <LoadingSkeleton variant="card" />
            ) : errorPredictions ? (
              <ErrorState onRetry={() => refetchPredictions()} />
            ) : predictions ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative h-32 w-32">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-muted"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={`${predictions.readinessPercent * 2.51} 251`}
                      strokeLinecap="round"
                      className="text-primary"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">
                      {formatPercent(predictions.readinessPercent, 0)}
                    </span>
                    <span className="text-xs text-muted-foreground">Readiness</span>
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  <p>
                    Predicted:{" "}
                    <span className="font-medium text-foreground">
                      {predictions.predictedScore}%
                    </span>
                  </p>
                  <p>Confidence: {formatPercent(predictions.confidence, 0)}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {predictions.factors.map((factor) => (
                    <Badge key={factor} variant="outline" className="text-xs">
                      {factor}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFeedback("predictions", true)}
                    disabled={feedbackMutation.isPending}
                    aria-label="Thumbs up"
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFeedback("predictions", false)}
                    disabled={feedbackMutation.isPending}
                    aria-label="Thumbs down"
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Brain}
                title="No predictions yet"
                description="Complete more assessments to get predictions"
              />
            )}
          </CardContent>
        </Card>

        {/* Study Plan */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Study Plan</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generatePlanMutation.mutate(studentId)}
              disabled={generatePlanMutation.isPending}
            >
              {generatePlanMutation.isPending ? "Generating..." : "Regenerate"}
            </Button>
          </CardHeader>
          <CardContent>
            {loadingPlan ? (
              <LoadingSkeleton variant="card" />
            ) : errorPlan ? (
              <ErrorState onRetry={() => refetchPlan()} />
            ) : studyPlan ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Week {studyPlan.week}</p>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Focus Topics</p>
                  <div className="flex flex-wrap gap-1">
                    {studyPlan.topics.map((topic) => (
                      <Badge key={topic} variant="secondary" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Tasks</p>
                  <ul className="space-y-1">
                    {studyPlan.tasks.map((task, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-muted-foreground">•</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFeedback(`study-plan-${studyPlan.id}`, true)}
                    disabled={feedbackMutation.isPending}
                    aria-label="Thumbs up"
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFeedback(`study-plan-${studyPlan.id}`, false)}
                    disabled={feedbackMutation.isPending}
                    aria-label="Thumbs down"
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Brain}
                title="No study plan"
                description="Generate a personalized study plan"
                action={{
                  label: "Generate Plan",
                  onClick: () => generatePlanMutation.mutate(studentId),
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Weak Topics */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Weak Topics</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTopics ? (
              <LoadingSkeleton variant="card" />
            ) : errorTopics ? (
              <ErrorState onRetry={() => refetchTopics()} />
            ) : weakTopics && weakTopics.length > 0 ? (
              <div className="space-y-3">
                {weakTopics.map((topic) => {
                  const TrendIcon = TREND_ICONS[topic.trend];
                  return (
                    <div key={topic.topic} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{topic.topic}</span>
                        <div className="flex items-center gap-1">
                          <TrendIcon className={cn("h-3 w-3", TREND_COLORS[topic.trend])} />
                          <span className="text-xs text-muted-foreground">
                            {topic.questionsAttempted} Qs
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              topic.accuracy >= 70
                                ? "bg-green-500"
                                : topic.accuracy >= 40
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            )}
                            style={{ width: `${topic.accuracy}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-medium">
                          {formatPercent(topic.accuracy, 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Brain}
                title="No weak topics identified"
                description="Take more assessments to get personalized insights"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommended Practice Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recommended Practice Questions</CardTitle>
        </CardHeader>
        <CardContent>
          {weakTopics && weakTopics.length > 0 ? (
            <div className="space-y-2">
              {weakTopics.slice(0, 5).map((topic) => (
                <div
                  key={topic.topic}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{topic.topic}</p>
                    <p className="text-xs text-muted-foreground">
                      Practice questions to improve your accuracy
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/exams">Practice</Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No recommendations available yet. Complete more assessments to get personalized
              suggestions.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
