import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { Plan, Subscription, Usage, Invoice } from "../schemas/billing-schemas";

export function usePlans() {
  return useQuery({
    queryKey: qk.billing.plans(),
    queryFn: () => api.get<Plan[]>("/billing/plans"),
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: qk.billing.subscription(),
    queryFn: () => api.get<Subscription>("/billing/subscription"),
  });
}

export function useUsage() {
  return useQuery({
    queryKey: qk.billing.usage(),
    queryFn: () => api.get<Usage>("/billing/usage"),
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: qk.billing.invoices(),
    queryFn: () => api.get<Invoice[]>("/billing/invoices"),
  });
}
