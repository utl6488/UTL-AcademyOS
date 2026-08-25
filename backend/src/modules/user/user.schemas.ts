import { z } from 'zod';

export const UserListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  role: z
    .enum(['SUPER_ADMIN', 'INSTITUTE_OWNER', 'ADMIN', 'TEACHER', 'EXAM_COORDINATOR', 'STUDENT'])
    .optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'DELETED']).optional(),
  classId: z.string().optional(),
  batchId: z.string().optional(),
  tenantId: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional(),
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

export const InviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  role: z.enum(['ADMIN', 'TEACHER', 'EXAM_COORDINATOR', 'STUDENT']),
  classId: z.string().optional(),
  batchId: z.string().optional(),
});
export type InviteUserInput = z.infer<typeof InviteUserSchema>;

export const UpdateUserSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    phone: z.string().max(30).nullable().optional(),
    avatar: z.string().url().nullable().optional(),
    branchId: z.string().nullable().optional(),
    classId: z.string().nullable().optional(),
    sectionId: z.string().nullable().optional(),
    batchId: z.string().nullable().optional(),
  })
  .strict();
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const PhotoUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export const ImportUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export const ImportPreviewSchema = z.object({
  fileKey: z.string().min(1),
});

export const ImportStartSchema = z.object({
  fileKey: z.string().min(1),
  role: z.enum(['STUDENT', 'TEACHER']).default('STUDENT'),
  classId: z.string().optional(),
});
