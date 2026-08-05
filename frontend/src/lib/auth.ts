import { api, setAccessToken, setRefreshToken } from "./api-client";
import { connectSocket, disconnectSocket } from "./socket";

export type Role =
  "SUPER_ADMIN" | "INSTITUTE_OWNER" | "ADMIN" | "TEACHER" | "EXAM_COORDINATOR" | "STUDENT";

export type UserStatus = "ACTIVE" | "INVITED" | "SUSPENDED" | "DELETED";

/** Public user shape returned by GET /auth/me and login/signup responses. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
  tenantId: string;
  tenant?: { id: string; name: string; slug: string };
  permissions: string[];
  lastLoginAt?: string | null;
}

export interface AuthResponse {
  user: User;
  tokens: { access: string; refresh: string };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await api.post<AuthResponse>("/auth/login", { email, password });
  setAccessToken(data.tokens.access);
  setRefreshToken(data.tokens.refresh);
  connectSocket();
  return data;
}

export async function signup(payload: {
  instituteName: string;
  ownerName: string;
  email: string;
  password: string;
}): Promise<AuthResponse & { tenant: { id: string; name: string; slug: string } }> {
  const data = await api.post<
    AuthResponse & { tenant: { id: string; name: string; slug: string } }
  >("/auth/signup", payload);
  setAccessToken(data.tokens.access);
  setRefreshToken(data.tokens.refresh);
  connectSocket();
  return data;
}

export async function logout(): Promise<void> {
  const refresh = typeof window !== "undefined" ? window.localStorage.getItem("utl:rt") : null;
  try {
    if (refresh) await api.post("/auth/logout", { refreshToken: refresh });
  } finally {
    setAccessToken(null);
    setRefreshToken(null);
    disconnectSocket();
  }
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post("/auth/forgot-password", { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post("/auth/reset-password", { token, password });
}

export async function verifyEmail(token: string): Promise<void> {
  await api.post("/auth/verify-email", { token });
}

export async function getMe(): Promise<User> {
  return api.get<User>("/auth/me");
}
