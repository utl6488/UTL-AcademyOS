import { z } from "zod";

export const userStatusSchema = z.enum(["ACTIVE", "INVITED", "SUSPENDED", "DELETED"]);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const userListItemSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  avatar: z.string().nullable(),
  phone: z.string().nullable().optional(),
  role: z.string(),
  status: userStatusSchema,
  tenantId: z.string().optional(),
  tenantName: z.string().nullable().optional(),
  classId: z.string().nullable(),
  className: z.string().nullable(),
  branchId: z.string().nullable().optional(),
  branchName: z.string().nullable().optional(),
  sectionId: z.string().nullable().optional(),
  sectionName: z.string().nullable().optional(),
  batchId: z.string().nullable(),
  batchName: z.string().nullable(),
  lastLogin: z.string().nullable(),
  createdAt: z.string(),
});

export type UserListItem = z.infer<typeof userListItemSchema>;

export const userDetailSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  avatar: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.string(),
  status: userStatusSchema,
  tenantId: z.string().optional(),
  tenantName: z.string().nullable().optional(),
  classId: z.string().nullable(),
  className: z.string().nullable(),
  branchId: z.string().nullable().optional(),
  branchName: z.string().nullable().optional(),
  batchId: z.string().nullable(),
  batchName: z.string().nullable(),
  sectionId: z.string().nullable(),
  sectionName: z.string().nullable(),
  examsTaken: z.number().optional().default(0),
  averageScore: z.number().nullable().optional().default(null),
  lastLogin: z.string().nullable(),
  createdAt: z.string(),
});

export type UserDetail = z.infer<typeof userDetailSchema>;

export const inviteTeacherSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["TEACHER", "ADMIN"]),
});

export type InviteTeacherFormValues = z.infer<typeof inviteTeacherSchema>;

export const inviteStudentSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  classId: z.string().optional(),
  batchId: z.string().optional(),
});

export type InviteStudentFormValues = z.infer<typeof inviteStudentSchema>;

export const importJobSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  totalRows: z.number(),
  processedRows: z.number(),
  successCount: z.number(),
  errorCount: z.number(),
  errors: z.array(
    z.object({
      row: z.number(),
      field: z.string(),
      message: z.string(),
    })
  ),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export type ImportJob = z.infer<typeof importJobSchema>;

export const importPreviewSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.record(z.string())),
  totalRows: z.number(),
  errors: z.array(
    z.object({
      row: z.number(),
      field: z.string(),
      message: z.string(),
    })
  ),
});

export type ImportPreview = z.infer<typeof importPreviewSchema>;
