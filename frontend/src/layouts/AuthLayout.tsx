import { Outlet } from "react-router-dom";

export function AuthLayout() {
  // In dev mode, always show auth pages for preview (no redirect)
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
