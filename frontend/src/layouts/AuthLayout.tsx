import { Outlet } from "react-router-dom";

export function AuthLayout() {
  // In dev mode, always show auth pages for preview (no redirect)
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary">UTL ExamPro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comprehensive examination management platform
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
