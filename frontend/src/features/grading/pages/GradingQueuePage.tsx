import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Eye, ToggleLeft, ToggleRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useGradingQueue } from "../api/queries";
import { useReleaseResultsMutation, useUnreleaseResultsMutation } from "../api/mutations";

export default function GradingQueuePage() {
  const navigate = useNavigate();
  const { data: queue, isLoading, isError, refetch } = useGradingQueue();
  const releaseMutation = useReleaseResultsMutation();
  const unreleaseMutation = useUnreleaseResultsMutation();

  if (isLoading) return <LoadingSkeleton variant="card" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Grading" description="Grade subjective answers and release results" />

      {queue?.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing to grade"
          description="All exams are either fully graded or have no subjective questions"
        />
      ) : (
        <div className="space-y-4">
          {queue?.map((item) => {
            const progress =
              item.totalCount > 0 ? Math.round((item.gradedCount / item.totalCount) * 100) : 0;

            return (
              <Card key={item.examId}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="font-medium">{item.examTitle}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>
                          {item.gradedCount}/{item.totalCount} graded
                        </span>
                        <span>·</span>
                        <span className="font-medium text-warning">
                          {item.pendingCount} pending
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 w-48 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Release toggle */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          item.released
                            ? unreleaseMutation.mutate(item.examId)
                            : releaseMutation.mutate(item.examId)
                        }
                        disabled={releaseMutation.isPending || unreleaseMutation.isPending}
                      >
                        {item.released ? (
                          <>
                            <ToggleRight className="mr-1 h-4 w-4 text-success" /> Released
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="mr-1 h-4 w-4" /> Release
                          </>
                        )}
                      </Button>

                      <Badge variant={item.pendingCount > 0 ? "warning" : "success"}>
                        {item.pendingCount > 0 ? "Pending" : "Done"}
                      </Badge>

                      <Button size="sm" onClick={() => navigate(`/grading/${item.examId}`)}>
                        <Eye className="mr-1 h-4 w-4" /> Grade
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
