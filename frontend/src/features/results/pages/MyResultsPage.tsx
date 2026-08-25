import { Link, Navigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";
import { useMyAttempts } from "../api/queries";
import type { MyAttempt } from "../schemas/results-schemas";

const STATUS_BADGE: Record<
  MyAttempt["status"],
  { variant: "default" | "secondary" | "success" | "warning"; label: string }
> = {
  SUBMITTED: { variant: "secondary", label: "Submitted" },
  AUTO_SUBMITTED: { variant: "warning", label: "Auto-submitted" },
  EVALUATED: { variant: "success", label: "Evaluated" },
};

export default function MyResultsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isStudent = role === "STUDENT";

  const { data: attempts, isLoading, isError, refetch } = useMyAttempts({ enabled: isStudent });

  if (!isStudent) return <Navigate to="/analytics" replace />;
  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="My Results" description="Your submitted exam attempts" />

      {!attempts || attempts.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No results yet"
          description="Your exam results will appear here after you submit an exam."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((a) => {
                const status = STATUS_BADGE[a.status];
                const scoreLabel =
                  a.score !== null ? `${a.score}/${a.maxScore}` : `— / ${a.maxScore}`;
                return (
                  <TableRow key={a.attemptId}>
                    <TableCell className="font-medium">{a.examTitle}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(a.submittedAt)}
                    </TableCell>
                    <TableCell>{scoreLabel}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {a.resultsReleased ? (
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/results/${a.attemptId}`}>View</Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending release</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
