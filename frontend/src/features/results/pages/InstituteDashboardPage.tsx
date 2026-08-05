import { useState } from "react";
import { BarChart3, Users, ClipboardList, AlertTriangle, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useInstituteDashboard } from "../api/queries";
import { useBatchTrends } from "@/features/ai/api/queries";
import { useBatches } from "@/features/org/api/queries";
import { formatNumber, formatPercent, formatDate } from "@/lib/format";

export default function InstituteDashboardPage() {
  const { data, isLoading, isError, refetch } = useInstituteDashboard();
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const batchesQuery = useBatches();
  const trendsQuery = useBatchTrends(selectedBatchId || undefined);

  if (isLoading) return <LoadingSkeleton variant="card" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Institute Analytics" description="High-level performance overview" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          icon={ClipboardList}
          label="Exams Conducted"
          value={formatNumber(data.examsConduted)}
          color="text-primary"
        />
        <KPICard
          icon={BarChart3}
          label="Average Score"
          value={formatPercent(data.averageScore)}
          color="text-success"
        />
        <KPICard
          icon={Users}
          label="Active Students"
          value={formatNumber(data.activeStudents)}
          color="text-info"
        />
        <KPICard
          icon={AlertTriangle}
          label="At-Risk Students"
          value={formatNumber(data.atRiskCount)}
          color="text-destructive"
        />
      </div>

      {/* Recent Exams */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Exams</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.recentExams.map((exam) => (
              <div
                key={exam.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{exam.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(exam.date)} · {exam.students} students
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatPercent(exam.avgScore)}</p>
                  <p className="text-xs text-muted-foreground">avg score</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Batch Performance Trends */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Batch Performance Trends
          </CardTitle>
          <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Choose a batch..." />
            </SelectTrigger>
            <SelectContent>
              {batchesQuery.data?.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name} · {b.className}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {!selectedBatchId && (
            <p className="text-sm italic text-muted-foreground">
              Select a batch to see per-exam trends and weak topics.
            </p>
          )}
          {selectedBatchId && trendsQuery.isLoading && <LoadingSkeleton variant="card" />}
          {trendsQuery.isError && (
            <p className="text-sm text-destructive">Failed to load batch trends.</p>
          )}
          {trendsQuery.data && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{trendsQuery.data.batchName}</span>
                <Badge variant="outline">{trendsQuery.data.memberCount} students</Badge>
                <TrendBadge trend={trendsQuery.data.averageAccuracyTrend} />
              </div>

              {trendsQuery.data.exams.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  No results yet for this batch.
                </p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsQuery.data.exams}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        dataKey="examTitle"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="averageAccuracy"
                        name="Accuracy %"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {trendsQuery.data.weakTopics.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Weak topics
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {trendsQuery.data.weakTopics.map((t) => (
                      <Badge key={t.topic} variant="outline">
                        {t.topic} · {t.averageAccuracy}% ({t.questionCount}q)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TrendBadge({ trend }: { trend: "improving" | "declining" | "stable" }) {
  const label =
    trend === "improving" ? "Improving" : trend === "declining" ? "Declining" : "Stable";
  const variant =
    trend === "improving" ? "success" : trend === "declining" ? "destructive" : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}

function KPICard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-md bg-muted p-2.5`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
