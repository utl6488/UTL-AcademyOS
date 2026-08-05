import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import type { User } from "@/lib/auth";
import { api, setAccessToken, setRefreshToken } from "@/lib/api-client";
import { parseApiResponse } from "@/lib/api-response";
import { qk } from "@/lib/query-keys";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";

import { authResponseSchema } from "../schemas/auth-schemas";

import type {
  ForgotPasswordFormValues,
  LoginFormValues,
  ResetPasswordFormValues,
  SignupFormValues,
} from "../schemas/auth-schemas";

/** Post-auth side effects: store tokens, seed cache, connect socket, redirect. */
function completeAuth(
  data: { user: User; tokens: { access: string; refresh: string } },
  queryClient: ReturnType<typeof useQueryClient>,
  setUser: (u: User | null) => void,
  navigate: ReturnType<typeof useNavigate>,
  greeting: string
) {
  setAccessToken(data.tokens.access);
  setRefreshToken(data.tokens.refresh);
  setUser(data.user);
  queryClient.setQueryData(qk.auth.me(), data.user);
  connectSocket();
  toast.success(greeting, `Signed in as ${data.user.name}`);

  if (data.user.role === "SUPER_ADMIN") navigate("/admin");
  else navigate("/");
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (data: LoginFormValues) => {
      const response = await api.post<unknown>("/auth/login", data);
      return parseApiResponse(authResponseSchema, response);
    },
    onSuccess: (data) => completeAuth(data, queryClient, setUser, navigate, "Welcome back!"),
  });
}

export function useSignupMutation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (data: SignupFormValues) => {
      const { instituteName, ownerName, email, password } = data;
      const response = await api.post<unknown>("/auth/signup", {
        instituteName,
        ownerName,
        email,
        password,
      });
      return parseApiResponse(authResponseSchema, response);
    },
    onSuccess: (data) => completeAuth(data, queryClient, setUser, navigate, "Institute created!"),
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: async (data: ForgotPasswordFormValues) => {
      return api.post<void>("/auth/forgot-password", data);
    },
    onSuccess: () => {
      toast.success("If that email exists", "We've sent a password reset link.");
    },
  });
}

export function useResetPasswordMutation() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async ({ token, ...data }: ResetPasswordFormValues & { token: string }) => {
      return api.post<void>("/auth/reset-password", { token, password: data.password });
    },
    onSuccess: () => {
      toast.success("Password reset", "Your password has been changed. Please log in.");
      navigate("/auth/login");
    },
  });
}

export function useVerifyEmailMutation() {
  return useMutation({
    mutationFn: async (token: string) => {
      return api.post<void>("/auth/verify-email", { token });
    },
    onSuccess: () => {
      toast.success("Email verified", "Your email has been verified successfully.");
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const reset = useAuthStore((s) => s.reset);

  return useMutation({
    mutationFn: async () => {
      const refresh = typeof window !== "undefined" ? window.localStorage.getItem("utl:rt") : null;
      if (refresh) {
        await api.post<void>("/auth/logout", { refreshToken: refresh }).catch(() => {
          // Best-effort; local state still gets cleared in onSettled.
        });
      }
    },
    onSettled: () => {
      setAccessToken(null);
      setRefreshToken(null);
      disconnectSocket();
      reset();
      queryClient.clear();
      navigate("/auth/login");
    },
  });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (familyId: string) => {
      return api.delete<void>(`/auth/sessions/${familyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.auth.sessions() });
      toast.success("Session revoked");
    },
  });
}
