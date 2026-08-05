import { Check } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { usePlans, useSubscription } from "../api/queries";
import { useCreateCheckoutMutation } from "../api/mutations";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  const { data: plans, isLoading: loadingPlans, isError: errorPlans, refetch } = usePlans();
  const { data: subscription } = useSubscription();
  const checkoutMutation = useCreateCheckoutMutation();

  if (loadingPlans) return <LoadingSkeleton variant="card" />;
  if (errorPlans) return <ErrorState onRetry={() => refetch()} />;

  const currentPlanId = subscription?.planId;

  return (
    <div className="space-y-6">
      <PageHeader title="Pricing Plans" description="Choose the plan that fits your institution" />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans?.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <Card
              key={plan.id}
              className={cn("relative", isCurrent && "border-primary ring-2 ring-primary/20")}
            >
              {isCurrent && (
                <Badge className="absolute -top-2.5 left-4" variant="default">
                  Current Plan
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plan.name}</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(plan.price)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{plan.interval === "monthly" ? "mo" : "yr"}
                    </span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Limits */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Students</span>
                    <span className="font-medium">{formatNumber(plan.limits.students)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exams</span>
                    <span className="font-medium">{formatNumber(plan.limits.exams)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">AI Credits</span>
                    <span className="font-medium">{formatNumber(plan.limits.aiCredits)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Storage</span>
                    <span className="font-medium">{plan.limits.storage} GB</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2 border-t pt-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || checkoutMutation.isPending}
                  onClick={() => checkoutMutation.mutate({ planId: plan.id, provider: "stripe" })}
                >
                  {isCurrent ? "Current" : "Upgrade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
