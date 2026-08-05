import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useNotifications, useUnreadCount } from "../api/queries";
import { useMarkReadMutation } from "../api/mutations";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationDropdown() {
  const { data: unreadData } = useUnreadCount();
  const { data: notifications } = useNotifications({ read: false });
  const markReadMutation = useMarkReadMutation();

  const unreadCount = unreadData?.count ?? 0;
  const latestNotifications = (notifications ?? []).slice(0, 5);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notifications</h4>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {latestNotifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No unread notifications
            </div>
          ) : (
            <div className="divide-y">
              {latestNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "cursor-pointer px-4 py-3 transition-colors hover:bg-muted/50",
                    !notification.read && "bg-primary/5"
                  )}
                  onClick={() => {
                    if (!notification.read) {
                      markReadMutation.mutate(notification.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      if (!notification.read) {
                        markReadMutation.mutate(notification.id);
                      }
                    }
                  }}
                >
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t px-4 py-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link to="/notifications">View all</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
