import { useParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useClassReport } from "../api/queries";
import { formatPercent, formatNumber } from "@/lib/format";

export default function ClassReportPage() {
  const { examId } = useParams<{ examId: string }>();
  const { data: report, isLoading, isError, refetch } = useClassReport(examId!);

  if (isLoading) return <LoadingSkeleton variant="card" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!report) return null;

  return (
    <div className="space-y-6">
      <PageHeader title={report.examTitle} description="Class performance report" />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Students" value={formatNumber(report.totalStudents)} />
        <StatCard label="Attempted" value={formatNumber(report.attemptedStudents)} />
        <StatCard label="Average" value={formatPercent(report.averageScore)} />
        <StatCard label="Highest" value={formatPercent(report.highestScore)} />
        <StatCard label="Pass Rate" value={formatPercent(report.passRate)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" className="text-xs" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {report.scoreDistribution.map((_, index) => (
                      <Cell
                        key={index}
                        fill={`hsl(var(--primary) / ${0.4 + (index / report.scoreDistribution.length) * 0.6})`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Completion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Completion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <FunnelBar
                label="Assigned"
                value={report.completionFunnel.assigned}
                max={report.completionFunnel.assigned}
              />
              <FunnelBar
                label="Started"
                value={report.completionFunnel.started}
                max={report.completionFunnel.assigned}
              />
              <FunnelBar
                label="Completed"
                value={report.completionFunnel.completed}
                max={report.completionFunnel.assigned}
              />
              <FunnelBar
                label="Passed"
                value={report.completionFunnel.passed}
                max={report.completionFunnel.assigned}
              />
            </div>
          </CardContent>
        </Card>

        {/* Toppers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.toppers.map((topper) => (
                <div key={topper.rank} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={topper.rank <= 3 ? "default" : "secondary"}
                      className="flex h-6 w-6 items-center justify-center rounded-full p-0 text-xs"
                    >
                      {topper.rank}
                    </Badge>
                    <span className="text-sm font-medium">{topper.studentName}</span>
                  </div>
                  <span className="text-sm">
                    {topper.score} ({formatPercent(topper.percentage)})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weak Topics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weak Topics</CardTitle>
            <CardDescription>Topics where students struggled the most</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.weakTopics.map((topic) => (
                <div key={topic.topic} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{topic.topic}</span>
                    <span className="text-muted-foreground">
                      {formatPercent(topic.averageAccuracy)} avg
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-destructive/70"
                      style={{ width: `${topic.averageAccuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {value} ({formatPercent(pct)})
        </span>
      </div>
      <div className="h-3 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
