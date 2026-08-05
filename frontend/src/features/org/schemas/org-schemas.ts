import { z } from "zod";

// Branch
export const branchSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  address: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Branch = z.infer<typeof branchSchema>;

export const branchFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  code: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

export type BranchFormValues = z.infer<typeof branchFormSchema>;

// Academic Year
export const academicYearSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean(),
  createdAt: z.string(),
});

export type AcademicYear = z.infer<typeof academicYearSchema>;

// Class
export const classSchema = z.object({
  id: z.string(),
  name: z.string(),
  numericOrder: z.number(),
  branchId: z.string().nullable(),
  branchName: z.string().nullable(),
  sections: z.array(z.object({ id: z.string(), name: z.string() })),
  createdAt: z.string(),
});

export type Class = z.infer<typeof classSchema>;

export const classFormSchema = z.object({
  name: z.string().min(1, "Class name is required").max(50),
  numericOrder: z.number().min(1, "Order is required").max(20),
  branchId: z.string().optional(),
  sections: z.array(z.string().min(1)).min(1, "At least one section is required"),
});

export type ClassFormValues = z.infer<typeof classFormSchema>;

// Batch
export const batchSchema = z.object({
  id: z.string(),
  name: z.string(),
  classId: z.string(),
  className: z.string(),
  teacherId: z.string().nullable(),
  teacherName: z.string().nullable(),
  studentCount: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export type Batch = z.infer<typeof batchSchema>;

export const batchFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  classId: z.string().min(1, "Class is required"),
  teacherId: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export type BatchFormValues = z.infer<typeof batchFormSchema>;

// Subject
export const subjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  classIds: z.array(z.string()),
  topicCount: z.number(),
  createdAt: z.string(),
});

export type Subject = z.infer<typeof subjectSchema>;

export const subjectFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  code: z.string().max(20).optional(),
  classIds: z.array(z.string()).min(1, "At least one class is required"),
});

export type SubjectFormValues = z.infer<typeof subjectFormSchema>;

// Topic
export const topicSchema = z.object({
  id: z.string(),
  name: z.string(),
  subjectId: z.string(),
  parentId: z.string().nullable(),
  order: z.number(),
  children: z.array(z.lazy((): z.ZodType => topicSchema)).optional(),
  createdAt: z.string(),
});

export type Topic = z.infer<typeof topicSchema>;

export const topicFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  subjectId: z.string().min(1, "Subject is required"),
  parentId: z.string().optional(),
});

export type TopicFormValues = z.infer<typeof topicFormSchema>;
