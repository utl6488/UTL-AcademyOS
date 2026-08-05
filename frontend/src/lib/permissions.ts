import { useAuthStore } from "@/store/auth-store";

import type { Role } from "./auth";

/** Hooks — reactive checks against the current user in the auth store. */
export function useHasPermission(permission: string): boolean {
  return useAuthStore((s) => s.user?.permissions.includes(permission) ?? false);
}
export function useHasRole(role: Role): boolean {
  return useAuthStore((s) => s.user?.role === role);
}
export function useHasAnyRole(roles: Role[]): boolean {
  return useAuthStore((s) => (s.user ? roles.includes(s.user.role) : false));
}
export function useHasAllPermissions(permissions: string[]): boolean {
  return useAuthStore((s) => {
    const set = new Set(s.user?.permissions ?? []);
    return permissions.every((p) => set.has(p));
  });
}

/**
 * Role catalogue. Mirrors backend `Role` enum in `@utl/shared`.
 */
export const Roles = {
  SUPER_ADMIN: "SUPER_ADMIN",
  INSTITUTE_OWNER: "INSTITUTE_OWNER",
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
  EXAM_COORDINATOR: "EXAM_COORDINATOR",
  STUDENT: "STUDENT",
} as const satisfies Record<string, Role>;

/**
 * Permission catalogue. Mirrors backend `Permission` in `backend/src/config/constants.ts`.
 * IDs are colon-separated (`resource:action`).
 */
export const Permissions = {
  INSTITUTE_READ: "institute:read",
  INSTITUTE_MANAGE: "institute:manage",
  USER_READ: "user:read",
  USER_INVITE: "user:invite",
  USER_MANAGE: "user:manage",
  ORG_READ: "org:read",
  ORG_MANAGE: "org:manage",
  QUESTION_READ: "question:read",
  QUESTION_MANAGE: "question:manage",
  EXAM_READ: "exam:read",
  EXAM_MANAGE: "exam:manage",
  EXAM_TAKE: "exam:take",
  EXAM_GRADE: "exam:grade",
  RESULT_READ_OWN: "result:read:own",
  RESULT_READ_ALL: "result:read:all",
  RESULT_PUBLISH: "result:publish",
  BILLING_READ: "billing:read",
  BILLING_MANAGE: "billing:manage",
  AI_USE_STUDENT: "ai:use:student",
  AI_USE_TEACHER: "ai:use:teacher",
  PLATFORM_MANAGE: "platform:manage",
  TENANT_MANAGE: "tenant:manage",
} as const;
