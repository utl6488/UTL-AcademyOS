import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type {
  Tenant,
  TenantDetail,
  RevenueMetrics,
  FeatureFlag,
  SystemHealth,
} from "../schemas/admin-schemas";
import type { PaginatedResponse, PaginationParams } from "@/types";

export interface TenantFilters extends PaginationParams {
  status?: string;
  plan?: string;
  search?: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

export function useTenants(filters: TenantFilters = {}) {
  return useQuery({
    queryKey: qk.admin.tenants.list(filters),
    queryFn: () => api.get<PaginatedResponse<Tenant>>("/admin/tenants", filters),
  });
}

export function useTenantDetail(id: string) {
  return useQuery({
    queryKey: qk.admin.tenants.detail(id),
    queryFn: () => api.get<TenantDetail>(`/admin/tenants/${id}`),
    enabled: !!id,
  });
}

export function useRevenue() {
  return useQuery({
    queryKey: qk.admin.revenue(),
    queryFn: () => api.get<RevenueMetrics>("/admin/revenue"),
  });
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: qk.admin.featureFlags(),
    queryFn: () => api.get<FeatureFlag[]>("/admin/feature-flags"),
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: qk.admin.health(),
    queryFn: () => api.get<SystemHealth>("/admin/health"),
    refetchInterval: 30_000,
  });
}
