import { useRouteError, isRouteErrorResponse, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function ErrorBoundaryPage() {
  const error = useRouteError();

  let title = "Something went wrong";
  let description = "An unexpected error occurred. Please try again.";
  let status = 500;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    if (error.status === 404) {
      title = "Page not found";
      description = "The page you're looking for doesn't exist.";
    } else if (error.status === 403) {
      title = "Access denied";
      description = "You don't have permission to view this page.";
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <AlertTriangle className="h-16 w-16 text-destructive" />
        </div>
        <div className="space-y-2">
          <p className="text-6xl font-bold text-muted-foreground">{status}</p>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="max-w-md text-muted-foreground">{description}</p>
        </div>
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
