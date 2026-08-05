import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useRevenue } from "../api/queries";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function RevenueDashboardPage() {
  const { data: revenue, isLoading, isError, refetch } = useRevenue();

  if (isLoading) return <LoadingSkeleton variant="card" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!revenue) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Revenue" description="Financial metrics and growth trends" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="MRR" value={formatCurrency(revenue.mrr)} icon={DollarSign} />
        <MetricCard title="ARR" value={formatCurrency(revenue.arr)} icon={BarChart3} />
        <MetricCard
          title="Growth Rate"
          value={formatPercent(revenue.growthRate)}
          icon={TrendingUp}
          trend={revenue.growthRate >= 0 ? "up" : "down"}
        />
        <MetricCard
          title="Churn Rate"
          value={formatPercent(revenue.churnRate)}
          icon={TrendingDown}
          trend={revenue.churnRate <= 5 ? "up" : "down"}
        />
      </div>

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenue.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div
            className={cn(
              "rounded-full p-2",
              trend === "up" ? "bg-green-100 text-green-600 dark:bg-green-900/30" : "",
              trend === "down" ? "bg-red-100 text-red-600 dark:bg-red-900/30" : "",
              !trend && "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
