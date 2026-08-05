import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useMe } from "../api/queries";
import { setAccessToken } from "@/lib/api-client";
import { connectSocket, disconnectSocket } from "@/lib/socket";

/**
 * Main auth hook that bootstraps user session on app load.
 * Attempts to refresh token and fetch user data on mount.
 * Used in the root layout or providers to initialize auth state.
 */
export function useAuth() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const reset = useAuthStore((s) => s.reset);

  const { data, isError, isLoading: queryLoading } = useMe();

  useEffect(() => {
    if (queryLoading) {
      setLoading(true);
      return;
    }

    if (data) {
      setUser(data);
      connectSocket();
    } else if (isError) {
      setAccessToken(null);
      disconnectSocket();
      reset();
    }

    setLoading(false);
  }, [data, isError, queryLoading, setUser, setLoading, reset]);

  return {
    user,
    isAuthenticated,
    isLoading: isLoading || queryLoading,
  };
}
