import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { parseApiResponse, parseApiArrayResponse } from "@/lib/api-response";
import { userSchema, sessionSchema, type Session } from "../schemas/auth-schemas";
import type { User } from "@/lib/auth";

export function useMe() {
  return useQuery({
    queryKey: qk.auth.me(),
    queryFn: async () => {
      const data = await api.get<User>("/auth/me");
      return parseApiResponse(userSchema, data);
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSessions() {
  return useQuery({
    queryKey: qk.auth.sessions(),
    queryFn: async () => {
      const data = await api.get<Session[]>("/auth/sessions");
      return parseApiArrayResponse(sessionSchema, data);
    },
  });
}
