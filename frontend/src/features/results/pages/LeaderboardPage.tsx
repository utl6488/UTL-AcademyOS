import { useState } from "react";
import { useParams } from "react-router-dom";
import { Trophy, Medal } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useLeaderboard } from "../api/queries";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
  const { examId } = useParams<{ examId: string }>();
  const [scope, setScope] = useState("class");

  const { data, isLoading, isError, refetch } = useLeaderboard(examId!, { scope });

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const entries = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboard"
        description="See how you rank against others"
        actions={
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="class">Class</SelectItem>
              <SelectItem value="batch">Batch</SelectItem>
              <SelectItem value="institute">Institute</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow
                  key={entry.studentId}
                  className={cn(entry.isCurrentUser && "bg-primary/5 font-medium")}
                >
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {entry.rank <= 3 ? (
                        <RankMedal rank={entry.rank} />
                      ) : (
                        <span className="text-sm text-muted-foreground">{entry.rank}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {entry.studentAvatar ? (
                        <img
                          src={entry.studentAvatar}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">
                          {entry.studentName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                      )}
                      <span className="text-sm">
                        {entry.studentName}
                        {entry.isCurrentUser && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            You
                          </Badge>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {entry.score}/{entry.totalMarks}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatPercent(entry.percentage)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {entry.timeTakenMinutes}m
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RankMedal({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: "text-yellow-500",
    2: "text-gray-400",
    3: "text-amber-700",
  };
  return rank === 1 ? (
    <Trophy className={cn("h-5 w-5", colors[rank])} />
  ) : (
    <Medal className={cn("h-5 w-5", colors[rank])} />
  );
}
