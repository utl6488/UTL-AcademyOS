import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";

/**
 * Redirects authenticated users away from auth pages.
 * Redirects unauthenticated users to login with return-to state.
 */
export function useAuthRedirect(mode: "authenticated" | "unauthenticated") {
  const { isAuthenticated, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (mode === "authenticated" && !isAuthenticated) {
      navigate("/auth/login", { state: { from: location }, replace: true });
    }

    if (mode === "unauthenticated" && isAuthenticated) {
      const from = (location.state as { from?: Location })?.from?.pathname || "/";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, mode, navigate, location]);
}
