import { Globe, Monitor, Smartphone, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatRelativeTime } from "@/lib/format";

import { useRevokeSessionMutation } from "../api/mutations";
import { useSessions } from "../api/queries";
import type { Session } from "../schemas/auth-schemas";

function deviceIconFor(userAgent: string | null | undefined) {
  const ua = (userAgent ?? "").toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return <Smartphone className="h-5 w-5" />;
  }
  return <Monitor className="h-5 w-5" />;
}

function browserLabel(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown browser";
  if (/edg\//i.test(userAgent)) return "Edge";
  if (/chrome/i.test(userAgent)) return "Chrome";
  if (/firefox/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent)) return "Safari";
  return userAgent.split(" ")[0] ?? "Browser";
}

export default function SessionsPage() {
  const { data: sessions, isLoading, isError, refetch } = useSessions();
  const { mutate: revokeSession, isPending: isRevoking } = useRevokeSessionMutation();
  const [sessionToRevoke, setSessionToRevoke] = useState<Session | null>(null);

  if (isLoading) return <LoadingSkeleton variant="card" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active Sessions"
        description="Manage your active sessions across devices"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Sessions</CardTitle>
          <CardDescription>
            These are the devices that are currently logged in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sessions?.map((session, index) => (
              <div key={session.id}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-muted p-2">
                      {deviceIconFor(session.userAgent)}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{browserLabel(session.userAgent)}</div>
                      <p
                        className="line-clamp-1 text-xs text-muted-foreground"
                        title={session.userAgent ?? undefined}
                      >
                        {session.userAgent ?? "Unknown device"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        <span>{session.ip ?? "Unknown IP"}</span>
                        <span>·</span>
                        <span>Started {formatRelativeTime(session.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setSessionToRevoke(session)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!sessionToRevoke}
        onOpenChange={() => setSessionToRevoke(null)}
        title="Revoke session"
        description={`Are you sure you want to revoke this session? The device will be logged out immediately.`}
        confirmLabel="Revoke"
        variant="destructive"
        loading={isRevoking}
        onConfirm={() => {
          if (sessionToRevoke) {
            revokeSession(sessionToRevoke.familyId);
            setSessionToRevoke(null);
          }
        }}
      />
    </div>
  );
}
