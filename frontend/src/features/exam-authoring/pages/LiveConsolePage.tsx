import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Radio, AlertTriangle, Send, Ban, Eye } from "lucide-react";
import { connectSocket } from "@/lib/socket";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useLiveConsole } from "../api/queries";
import { useForcSubmitAttemptMutation, useSendWarningMutation } from "../api/mutations";
import { formatRelativeTime } from "@/lib/format";
import type { LiveAttempt } from "../schemas/exam-schemas";

export default function LiveConsolePage() {
  const { id: examId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: attempts, isLoading, isError, refetch } = useLiveConsole(examId!);
  const forceSubmitMutation = useForcSubmitAttemptMutation();
  const sendWarningMutation = useSendWarningMutation();

  const [warningTarget, setWarningTarget] = useState<LiveAttempt | null>(null);
  const [warningMessage, setWarningMessage] = useState("");

  // Realtime: join exam-console room and invalidate the polled query on push.
  // Server still drives the source of truth via /live-console; the socket just
  // collapses latency between event and re-fetch.
  useEffect(() => {
    if (!examId) return;
    const socket = connectSocket();
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: qk.exams.liveConsole(examId) });

    const join = () => socket.emit("exam:console:join", { examId });
    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("attempt:submitted", invalidate);
    socket.on("attempt:flagged", invalidate);

    return () => {
      socket.off("connect", join);
      socket.off("attempt:submitted", invalidate);
      socket.off("attempt:flagged", invalidate);
    };
  }, [examId, queryClient]);

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const inProgress = attempts?.filter((a) => a.status === "in_progress") || [];
  const submitted = attempts?.filter((a) => a.status === "submitted") || [];
  const lockedOut = attempts?.filter((a) => a.status === "locked_out") || [];

  function handleSendWarning() {
    if (warningTarget && warningMessage) {
      sendWarningMutation.mutate(
        { examId: examId!, attemptId: warningTarget.attemptId, message: warningMessage },
        {
          onSuccess: () => {
            setWarningTarget(null);
            setWarningMessage("");
          },
        }
      );
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Exams", href: "/exams" }, { label: "Live Console" }]} />

      <PageHeader
        title="Live Exam Console"
        description="Real-time monitoring of active exam attempts"
        actions={
          <Badge variant="success" className="flex items-center gap-1">
            <Radio className="h-3 w-3 animate-pulse" /> Live
          </Badge>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{inProgress.length}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-success">{submitted.length}</p>
            <p className="text-sm text-muted-foreground">Submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-destructive">{lockedOut.length}</p>
            <p className="text-sm text-muted-foreground">Locked Out</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Attempts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Attempts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Violations</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts?.map((attempt) => (
                  <TableRow key={attempt.attemptId}>
                    <TableCell className="font-medium">{attempt.studentName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          attempt.status === "in_progress"
                            ? "success"
                            : attempt.status === "submitted"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {attempt.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeTime(attempt.startedAt)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={attempt.violationCount > 0 ? "font-medium text-warning" : ""}
                      >
                        {attempt.violationCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      <RiskBadge score={attempt.riskScore} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View event timeline"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Send warning"
                          onClick={() => setWarningTarget(attempt)}
                          disabled={attempt.status !== "in_progress"}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          title="Force submit"
                          onClick={() =>
                            forceSubmitMutation.mutate({
                              examId: examId!,
                              attemptId: attempt.attemptId,
                            })
                          }
                          disabled={attempt.status !== "in_progress"}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Send Warning Dialog */}
      <Dialog open={!!warningTarget} onOpenChange={() => setWarningTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Warning</DialogTitle>
            <DialogDescription>Send a message to {warningTarget?.studentName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="Type your warning message..."
              value={warningMessage}
              onChange={(e) => setWarningMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarningTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleSendWarning} loading={sendWarningMutation.isPending}>
              <AlertTriangle className="mr-2 h-4 w-4" /> Send Warning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  if (score >= 70) return <Badge variant="destructive">High ({score})</Badge>;
  if (score >= 40) return <Badge variant="warning">Medium ({score})</Badge>;
  return <Badge variant="success">Low ({score})</Badge>;
}
