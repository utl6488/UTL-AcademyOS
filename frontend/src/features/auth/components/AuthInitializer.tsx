import { useEffect, useState } from "react";

import { getMe } from "@/lib/auth";
import { useAuthStore } from "@/store/auth-store";

interface AuthInitializerProps {
  children: React.ReactNode;
}

/**
 * Bootstraps auth state on app mount:
 *   1. If we have a refresh token in localStorage, `getMe` triggers a refresh
 *      via the api-client and returns the user.
 *   2. If refresh fails or no token exists, the user starts anonymous and the
 *      protected route wrapper will bounce them to /auth/login.
 */
export function AuthInitializer({ children }: AuthInitializerProps) {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((user) => {
        if (!cancelled) setUser(user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setUser, setLoading]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
