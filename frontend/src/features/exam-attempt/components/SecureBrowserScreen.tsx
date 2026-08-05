import { useState, useEffect } from "react";
import { Monitor, Download, ExternalLink, CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGetLaunchTokenMutation } from "../api/mutations";
import { api } from "@/lib/api-client";

interface SecureBrowserScreenProps {
  attemptId: string;
  examTitle: string;
}

function detectOS(): { os: string; arch: string } {
  const ua = navigator.userAgent;
  if (ua.includes("Win")) return { os: "Windows", arch: "x64" };
  if (ua.includes("Mac")) {
    // Rough detection for Apple Silicon
    if (ua.includes("ARM") || navigator.hardwareConcurrency > 8)
      return { os: "macOS", arch: "arm64" };
    return { os: "macOS", arch: "x64" };
  }
  if (ua.includes("Linux")) return { os: "Linux", arch: "x64" };
  return { os: "Unknown", arch: "" };
}

export function SecureBrowserScreen({ attemptId, examTitle }: SecureBrowserScreenProps) {
  const [launched, setLaunched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const launchTokenMutation = useGetLaunchTokenMutation();
  const { os } = detectOS();

  // Poll for status change after deep link
  useEffect(() => {
    if (!launched) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.get<{ status: string; attestedBy: string | null }>(
          `/attempts/${attemptId}/status`
        );
        if (data.status === "IN_PROGRESS" && data.attestedBy === "SECURE_BROWSER") {
          setConfirmed(true);
          clearInterval(interval);
        }
      } catch {
        /* ignore */
      }
    }, 2000);

    // Timeout after 60s
    const timeout = setTimeout(() => clearInterval(interval), 60000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [launched, attemptId]);

  async function handleLaunch() {
    const result = await launchTokenMutation.mutateAsync(attemptId);
    window.location.href = result.deepLink;
    setLaunched(true);
  }

  if (confirmed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-4 py-12">
            <CheckCircle className="mx-auto h-12 w-12 text-success" />
            <h2 className="text-xl font-bold">Secure Browser Active</h2>
            <p className="text-sm text-muted-foreground">
              You may close this browser tab. Continue your exam in the UTL Secure Browser.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mb-3 flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Monitor className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle>Secure Browser Required</CardTitle>
          <CardDescription>
            "{examTitle}" requires the UTL Secure Browser for enhanced proctoring.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Download links */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Download for your platform:</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className={os === "Windows" ? "border-primary" : ""}
              >
                <Download className="mr-1 h-3 w-3" /> Windows
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={os === "macOS" ? "border-primary" : ""}
              >
                <Download className="mr-1 h-3 w-3" /> macOS
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={os === "Linux" ? "border-primary" : ""}
              >
                <Download className="mr-1 h-3 w-3" /> Linux (.deb)
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-1 h-3 w-3" /> Linux (.AppImage)
              </Button>
            </div>
            {os !== "Unknown" && (
              <Badge variant="secondary" className="text-xs">
                Detected: {os}
              </Badge>
            )}
          </div>

          {/* Launch button */}
          <div className="space-y-3">
            <Button
              onClick={handleLaunch}
              loading={launchTokenMutation.isPending}
              className="w-full"
              size="lg"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {launched ? "Relaunch Secure Browser" : "Already installed? Launch Secure Browser"}
            </Button>

            {launched && !confirmed && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for Secure Browser to connect...
              </div>
            )}

            {launched && !confirmed && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Didn't open? Make sure the Secure Browser is installed and try again. Contact your
                teacher if the issue persists.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
