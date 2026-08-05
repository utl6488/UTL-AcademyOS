import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { parseApiResponse } from "@/lib/api-response";
import {
  userDetailSchema,
  importJobSchema,
  type UserListItem,
  type UserDetail,
  type ImportJob,
} from "../schemas/user-schemas";
import type { PaginatedResponse, PaginationParams } from "@/types";

interface UserFilters extends PaginationParams {
  role?: string;
  classId?: string;
  batchId?: string;
  status?: string;
}

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: qk.users.list(filters),
    queryFn: async () => {
      return api.get<PaginatedResponse<UserListItem>>("/users", filters);
    },
  });
}

export function useTeachers(filters?: PaginationParams) {
  return useQuery({
    queryKey: qk.users.list({ ...filters, role: "teacher" }),
    queryFn: async () => {
      return api.get<PaginatedResponse<UserListItem>>("/users", { ...filters, role: "teacher" });
    },
  });
}

export function useStudents(filters?: UserFilters) {
  return useQuery({
    queryKey: qk.users.list({ ...filters, role: "student" }),
    queryFn: async () => {
      return api.get<PaginatedResponse<UserListItem>>("/users", { ...filters, role: "student" });
    },
  });
}

export function useUserDetail(userId: string) {
  return useQuery({
    queryKey: qk.users.detail(userId),
    queryFn: async () => {
      const data = await api.get<UserDetail>(`/users/${userId}`);
      return parseApiResponse(userDetailSchema, data);
    },
    enabled: !!userId,
  });
}

export function useImportJob(jobId: string) {
  return useQuery({
    queryKey: qk.users.import(jobId),
    queryFn: async () => {
      const data = await api.get<ImportJob>(`/users/import/${jobId}`);
      return parseApiResponse(importJobSchema, data);
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "pending" || status === "processing") return 2000;
      return false;
    },
  });
}
