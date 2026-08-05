import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DisconnectModalProps {
  isSynchronous: boolean;
}

export function DisconnectModal({ isSynchronous }: DisconnectModalProps) {
  return (
    <div
      className="fixed inset-0 z-[99] flex items-center justify-center bg-black/80 p-4"
      role="alert"
    >
      <div className="w-full max-w-md space-y-4 rounded-lg bg-background p-8 text-center shadow-2xl">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <WifiOff className="h-8 w-8 animate-pulse text-destructive" />
          </div>
        </div>

        <h2 className="text-xl font-bold">Connection Lost</h2>

        <p className="text-sm text-muted-foreground">
          You've lost connection to the server. Your answers are saved locally and will be synced
          when the connection is restored.
        </p>

        {isSynchronous && (
          <p className="text-sm font-medium text-warning">
            ⚠️ The exam timer is still running. Reconnect as soon as possible.
          </p>
        )}

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Attempting to reconnect...
        </div>

        <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </div>
    </div>
  );
}
