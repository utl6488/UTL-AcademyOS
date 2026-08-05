import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <ShieldX className="h-16 w-16 text-destructive" />
        </div>
        <div className="space-y-2">
          <p className="text-6xl font-bold text-muted-foreground">403</p>
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="max-w-md text-muted-foreground">
            You don't have permission to access this page. Contact your administrator if you think
            this is a mistake.
          </p>
        </div>
        <Button asChild>
          <Link to="/">Go back home</Link>
        </Button>
      </div>
    </div>
  );
}
