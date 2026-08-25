import { Navigate, useLocation } from "react-router-dom";

import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import type { Role } from "@/lib/auth";
import { useAuthStore } from "@/store/auth-store";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Accept a single role or an array — user must have any one of them. */
  requiredRole?: Role | Role[];
  requiredPermission?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSkeleton variant="page" />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";

  if (requiredRole && !isSuperAdmin) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(user.role)) {
      return <Navigate to="/403" replace />;
    }
  }

  if (requiredPermission && !isSuperAdmin && !user.permissions.includes(requiredPermission)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
