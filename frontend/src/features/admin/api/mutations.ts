import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import type { OverridePlanRequest, CreateFeatureFlagRequest } from "../schemas/admin-schemas";

export function useSuspendTenantMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) => api.post(`/admin/tenants/${tenantId}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.tenants.all });
      toast.success("Tenant suspended");
    },
  });
}

export function useReactivateTenantMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) => api.post(`/admin/tenants/${tenantId}/reactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.tenants.all });
      toast.success("Tenant reactivated");
    },
  });
}

export function useOverridePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OverridePlanRequest) =>
      api.post(`/admin/tenants/${data.tenantId}/override-plan`, {
        planId: data.planId,
        trialDays: data.trialDays,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.admin.tenants.detail(variables.tenantId) });
      queryClient.invalidateQueries({ queryKey: qk.admin.tenants.all });
      toast.success("Plan override applied");
    },
  });
}

export function useToggleFeatureFlagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/admin/feature-flags/${id}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.featureFlags() });
    },
  });
}

export function useCreateFeatureFlagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFeatureFlagRequest) => api.post("/admin/feature-flags", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.featureFlags() });
      toast.success("Feature flag created");
    },
  });
}

export function useDeleteFeatureFlagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/feature-flags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.admin.featureFlags() });
      toast.success("Feature flag deleted");
    },
  });
}
