import { useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useTenantDetail } from "../api/queries";
import {
  useOverridePlanMutation,
  useSuspendTenantMutation,
  useReactivateTenantMutation,
} from "../api/mutations";
import { overridePlanRequestSchema, type OverridePlanRequest } from "../schemas/admin-schemas";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive"> = {
  active: "success",
  trialing: "default",
  suspended: "destructive",
  canceled: "warning",
};

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [overrideOpen, setOverrideOpen] = useState(false);

  const { data: tenant, isLoading, isError, refetch } = useTenantDetail(id!);
  const overrideMutation = useOverridePlanMutation();
  const suspendMutation = useSuspendTenantMutation();
  const reactivateMutation = useReactivateTenantMutation();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OverridePlanRequest>({
    resolver: zodResolver(overridePlanRequestSchema),
    defaultValues: {
      tenantId: id!,
      planId: "",
      trialDays: 0,
    },
  });

  if (isLoading) return <LoadingSkeleton variant="card" />;
  if (isError || !tenant) return <ErrorState onRetry={() => refetch()} />;

  const onOverridePlan = (data: OverridePlanRequest) => {
    overrideMutation.mutate(data, {
      onSuccess: () => setOverrideOpen(false),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tenant.name}
        description={`Tenant: ${tenant.slug}`}
        actions={
          <div className="flex gap-2">
            {tenant.status === "active" ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => suspendMutation.mutate(tenant.id)}
                disabled={suspendMutation.isPending}
              >
                Suspend
              </Button>
            ) : tenant.status === "suspended" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reactivateMutation.mutate(tenant.id)}
                disabled={reactivateMutation.isPending}
              >
                Reactivate
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tenant Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tenant Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Name" value={tenant.name} />
            <InfoRow label="Slug" value={tenant.slug} />
            <InfoRow label="Owner" value={`${tenant.owner.name} (${tenant.owner.email})`} />
            <InfoRow
              label="Status"
              value={
                <Badge variant={STATUS_VARIANT[tenant.status] ?? "default"}>{tenant.status}</Badge>
              }
            />
            <InfoRow label="Plan" value={tenant.planName} />
            <InfoRow label="Created" value={formatDate(tenant.createdAt)} />
          </CardContent>
        </Card>

        {/* Revenue & Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Total Revenue" value={formatCurrency(tenant.revenue)} />
            <InfoRow label="Users" value={formatNumber(tenant.usersCount)} />
            <InfoRow label="Subscription Status" value={tenant.subscription.status} />
            <InfoRow label="Period Ends" value={formatDate(tenant.subscription.currentPeriodEnd)} />
          </CardContent>
        </Card>
      </div>

      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <UsageStat
              label="Students"
              used={tenant.usage.students.used}
              limit={tenant.usage.students.limit}
            />
            <UsageStat
              label="Exams"
              used={tenant.usage.exams.used}
              limit={tenant.usage.exams.limit}
            />
            <UsageStat
              label="AI Credits"
              used={tenant.usage.aiCredits.used}
              limit={tenant.usage.aiCredits.limit}
            />
            <UsageStat
              label="Storage"
              used={tenant.usage.storage.usedMb}
              limit={tenant.usage.storage.limitMb}
              unit="MB"
            />
          </div>
        </CardContent>
      </Card>

      {/* Plan Override */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Plan Override</CardTitle>
          <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Override Plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Override Tenant Plan</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onOverridePlan)} className="space-y-4">
                <input type="hidden" {...register("tenantId")} />
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={watch("planId")} onValueChange={(v) => setValue("planId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.planId && (
                    <p className="text-sm text-destructive">{errors.planId.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trial-days">Trial Days</Label>
                  <Input id="trial-days" type="number" min={0} {...register("trialDays")} />
                  {errors.trialDays && (
                    <p className="text-sm text-destructive">{errors.trialDays.message}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOverrideOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={overrideMutation.isPending}>
                    {overrideMutation.isPending ? "Applying..." : "Apply Override"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Override the tenant's plan or apply a trial extension.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function UsageStat({
  label,
  used,
  limit,
  unit,
}: {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}) {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {formatNumber(used)} / {formatNumber(limit)} {unit ?? ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            percent >= 95 ? "bg-red-500" : percent >= 80 ? "bg-yellow-500" : "bg-primary"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
