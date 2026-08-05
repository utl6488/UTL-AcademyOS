import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { toast } from "@/lib/toast";
import type { CreateCheckoutRequest } from "../schemas/billing-schemas";

export function useCreateCheckoutMutation() {
  return useMutation({
    mutationFn: (data: CreateCheckoutRequest) =>
      api.post<{ checkoutUrl: string }>("/billing/checkout", data),
    onSuccess: (response) => {
      window.location.href = response.checkoutUrl;
    },
  });
}

export function useApplyCouponMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      api.post<{ discount: number; message: string }>("/billing/coupons/apply", { code }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: qk.billing.subscription() });
      toast.success("Coupon applied", data.message);
    },
  });
}

export function useCancelSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/billing/subscription/cancel"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.billing.subscription() });
      toast.success(
        "Subscription canceled",
        "Your plan will remain active until the end of the billing period."
      );
    },
  });
}

export function useResumeSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/billing/subscription/resume"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.billing.subscription() });
      toast.success("Subscription resumed", "Your plan will continue at the next billing cycle.");
    },
  });
}
