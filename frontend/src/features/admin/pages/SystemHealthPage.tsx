import { Activity, Database, HardDrive, AlertTriangle, Clock, Wifi } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useSystemHealth } from "../api/queries";
import { formatPercent, formatNumber, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  healthy: { label: "Healthy", color: "bg-green-500", variant: "success" as const },
  degraded: { label: "Degraded", color: "bg-yellow-500", variant: "warning" as const },
  down: { label: "Down", color: "bg-red-500", variant: "destructive" as const },
} as const;

export default function SystemHealthPage() {
  const { data: health, isLoading, isError, refetch } = useSystemHealth();

  if (isLoading) return <LoadingSkeleton variant="card" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!health) return null;

  const statusConfig = STATUS_CONFIG[health.status];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        description="Monitor infrastructure and service health"
        actions={
          <Badge variant={statusConfig.variant}>
            <span className={cn("mr-1.5 h-2 w-2 rounded-full", statusConfig.color)} />
            {statusConfig.label}
          </Badge>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <HealthCard
          title="Uptime"
          value={formatDuration(health.uptime)}
          icon={Clock}
          status={health.uptime > 86400 ? "healthy" : health.uptime > 3600 ? "degraded" : "down"}
        />
        <HealthCard
          title="DB Connections"
          value={formatNumber(health.dbConnections)}
          icon={Database}
          status={
            health.dbConnections < 80 ? "healthy" : health.dbConnections < 95 ? "degraded" : "down"
          }
        />
        <HealthCard
          title="Cache Hit Rate"
          value={formatPercent(health.cacheHitRate)}
          icon={HardDrive}
          status={
            health.cacheHitRate >= 90 ? "healthy" : health.cacheHitRate >= 70 ? "degraded" : "down"
          }
        />
        <HealthCard
          title="Queue Depth"
          value={formatNumber(health.queueDepth)}
          icon={Activity}
          status={
            health.queueDepth < 100 ? "healthy" : health.queueDepth < 500 ? "degraded" : "down"
          }
        />
        <HealthCard
          title="Error Rate"
          value={formatPercent(health.errorRate)}
          icon={AlertTriangle}
          status={health.errorRate < 1 ? "healthy" : health.errorRate < 5 ? "degraded" : "down"}
        />
        <HealthCard
          title="Overall Status"
          value={statusConfig.label}
          icon={Wifi}
          status={health.status}
        />
      </div>
    </div>
  );
}

function HealthCard({
  title,
  value,
  icon: Icon,
  status,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  status: "healthy" | "degraded" | "down";
}) {
  const colorMap = {
    healthy: "text-green-600 bg-green-100 dark:bg-green-900/30",
    degraded: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
    down: "text-red-600 bg-red-100 dark:bg-red-900/30",
  } as const;

  const borderMap = {
    healthy: "border-green-200 dark:border-green-800",
    degraded: "border-yellow-200 dark:border-yellow-800",
    down: "border-red-200 dark:border-red-800",
  } as const;

  return (
    <Card className={cn(borderMap[status])}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("rounded-full p-2", colorMap[status])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
