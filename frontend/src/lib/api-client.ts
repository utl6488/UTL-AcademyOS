import { env } from "./env";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | string[] | undefined>;
}

// -- Token storage --------------------------------------------------------
// Access token lives in memory (survives SPA nav, not full reload).
// Refresh token lives in localStorage so we can re-obtain an access token on reload.
// XSS trade-off is accepted here; move to httpOnly cookies before public launch.

const REFRESH_KEY = "utl:rt";
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

export function setRefreshToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(REFRESH_KEY, token);
  else window.localStorage.removeItem(REFRESH_KEY);
}
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

interface ApiEnvelope<T> {
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: unknown;
}

/**
 * Attempts a refresh-token rotation. Returns the new access token, or null if
 * refresh failed (caller should log the user out).
 */
async function refreshTokens(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) {
    setAccessToken(null);
    return null;
  }
  try {
    const res = await fetch(`${env.VITE_API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      setAccessToken(null);
      setRefreshToken(null);
      return null;
    }
    const body = (await res.json()) as ApiEnvelope<{
      tokens: { access: string; refresh: string };
    }>;
    const tokens = body.data?.tokens;
    if (!tokens) {
      setAccessToken(null);
      setRefreshToken(null);
      return null;
    }
    setAccessToken(tokens.access);
    setRefreshToken(tokens.refresh);
    return tokens.access;
  } catch {
    setAccessToken(null);
    setRefreshToken(null);
    return null;
  }
}

async function getValidToken(): Promise<string | null> {
  if (accessToken) return accessToken;
  if (!refreshPromise) {
    refreshPromise = refreshTokens().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiClient<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
  const { params, headers: customHeaders, ...restConfig } = config;

  const url = new URL(`${env.VITE_API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) return;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
      else url.searchParams.set(key, String(value));
    });
  }

  const token = await getValidToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response = await fetch(url.toString(), { ...restConfig, headers });

  // One retry after refreshing on 401.
  if (response.status === 401 && token) {
    const newToken = await refreshTokens();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      response = await fetch(url.toString(), { ...restConfig, headers });
    }
  }

  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!response.ok) {
    if (body?.error) {
      throw new ApiError(response.status, body.error.code, body.error.message, body.error.details);
    }
    throw new ApiError(response.status, "UNKNOWN_ERROR", `Request failed (${response.status})`);
  }

  return body.data as T;
}

export const api = {
  get: <T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | string[] | undefined>
  ) => apiClient<T>(endpoint, { method: "GET", params }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: "POST", body: body ? JSON.stringify(body) : undefined }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),

  patch: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(endpoint: string) => apiClient<T>(endpoint, { method: "DELETE" }),
};
