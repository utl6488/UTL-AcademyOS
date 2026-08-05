import { Ban, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function LockedOutScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="space-y-6 py-12">
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-4">
              <Ban className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold">Entry Closed</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The late-entry grace period for this exam has ended. You can no longer join this exam
              session.
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Please contact your teacher if you believe this is an error or if you need assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
