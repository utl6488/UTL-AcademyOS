import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useNotifications } from "../api/queries";
import { useMarkReadMutation, useMarkAllReadMutation } from "../api/mutations";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const filters = tab === "unread" ? { read: false } : undefined;

  const { data: notifications, isLoading, isError, refetch } = useNotifications(filters);
  const markReadMutation = useMarkReadMutation();
  const markAllReadMutation = useMarkAllReadMutation();

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const items = notifications ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay up to date with your activities"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {items.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications"
              description={tab === "unread" ? "You're all caught up!" : "Nothing here yet"}
            />
          ) : (
            <div className="space-y-2">
              {items.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-4 transition-colors",
                    !notification.read && "border-primary/20 bg-primary/5"
                  )}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <p className="text-sm font-medium">{notification.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {notification.link && (
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={notification.link} aria-label="View details">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markReadMutation.mutate(notification.id)}
                        disabled={markReadMutation.isPending}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
