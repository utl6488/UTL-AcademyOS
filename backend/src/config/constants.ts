import { type Role } from '@utl/shared';

/** Named permissions used by RBAC. Additive: `role -> Permission[]`. */
export const Permission = {
  // Institute
  INSTITUTE_READ: 'institute:read',
  INSTITUTE_MANAGE: 'institute:manage',
  // Users
  USER_READ: 'user:read',
  USER_INVITE: 'user:invite',
  USER_MANAGE: 'user:manage',
  // Org
  ORG_READ: 'org:read',
  ORG_MANAGE: 'org:manage',
  // Question bank
  QUESTION_READ: 'question:read',
  QUESTION_MANAGE: 'question:manage',
  // Exams
  EXAM_READ: 'exam:read',
  EXAM_MANAGE: 'exam:manage',
  EXAM_TAKE: 'exam:take',
  EXAM_GRADE: 'exam:grade',
  // Results
  RESULT_READ_OWN: 'result:read:own',
  RESULT_READ_ALL: 'result:read:all',
  RESULT_PUBLISH: 'result:publish',
  // Billing
  BILLING_READ: 'billing:read',
  BILLING_MANAGE: 'billing:manage',
  // AI
  AI_USE_STUDENT: 'ai:use:student',
  AI_USE_TEACHER: 'ai:use:teacher',
  // Super admin
  PLATFORM_MANAGE: 'platform:manage',
  TENANT_MANAGE: 'tenant:manage',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const P = Permission;

/** Role → default permissions. `SUPER_ADMIN` has everything by convention. */
export const RolePermissions: Record<Role, ReadonlyArray<Permission>> = {
  SUPER_ADMIN: Object.values(P),
  INSTITUTE_OWNER: [
    P.INSTITUTE_READ,
    P.INSTITUTE_MANAGE,
    P.USER_READ,
    P.USER_INVITE,
    P.USER_MANAGE,
    P.ORG_READ,
    P.ORG_MANAGE,
    P.QUESTION_READ,
    P.QUESTION_MANAGE,
    P.EXAM_READ,
    P.EXAM_MANAGE,
    P.EXAM_GRADE,
    P.RESULT_READ_ALL,
    P.RESULT_PUBLISH,
    P.BILLING_READ,
    P.BILLING_MANAGE,
    P.AI_USE_TEACHER,
  ],
  ADMIN: [
    P.INSTITUTE_READ,
    P.USER_READ,
    P.USER_INVITE,
    P.USER_MANAGE,
    P.ORG_READ,
    P.ORG_MANAGE,
    P.QUESTION_READ,
    P.QUESTION_MANAGE,
    P.EXAM_READ,
    P.EXAM_MANAGE,
    P.EXAM_GRADE,
    P.RESULT_READ_ALL,
    P.RESULT_PUBLISH,
    P.AI_USE_TEACHER,
  ],
  TEACHER: [
    P.INSTITUTE_READ,
    P.USER_READ,
    P.ORG_READ,
    P.QUESTION_READ,
    P.QUESTION_MANAGE,
    P.EXAM_READ,
    P.EXAM_MANAGE,
    P.EXAM_GRADE,
    P.RESULT_READ_ALL,
    P.RESULT_PUBLISH,
    P.AI_USE_TEACHER,
  ],
  EXAM_COORDINATOR: [
    P.INSTITUTE_READ,
    P.USER_READ,
    P.ORG_READ,
    P.QUESTION_READ,
    P.EXAM_READ,
    P.EXAM_MANAGE,
    P.RESULT_READ_ALL,
  ],
  STUDENT: [P.EXAM_READ, P.EXAM_TAKE, P.RESULT_READ_OWN, P.AI_USE_STUDENT],
};

export function permissionsFor(role: Role): ReadonlySet<Permission> {
  return new Set(RolePermissions[role]);
}
