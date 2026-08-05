import { useState } from "react";
import { Download, CreditCard, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useSubscription, useUsage, useInvoices } from "../api/queries";
import {
  useApplyCouponMutation,
  useCancelSubscriptionMutation,
  useResumeSubscriptionMutation,
} from "../api/mutations";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive"> = {
  active: "success",
  trialing: "default",
  past_due: "warning",
  canceled: "destructive",
  incomplete: "warning",
};

export default function BillingDashboardPage() {
  const [couponCode, setCouponCode] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const {
    data: subscription,
    isLoading: loadingSub,
    isError: errorSub,
    refetch: refetchSub,
  } = useSubscription();
  const { data: usage, isLoading: loadingUsage } = useUsage();
  const { data: invoices, isLoading: loadingInvoices } = useInvoices();

  const applyCouponMutation = useApplyCouponMutation();
  const cancelMutation = useCancelSubscriptionMutation();
  const resumeMutation = useResumeSubscriptionMutation();

  const isLoading = loadingSub || loadingUsage || loadingInvoices;
  if (isLoading) return <LoadingSkeleton variant="card" />;
  if (errorSub) return <ErrorState onRetry={() => refetchSub()} />;

  const handleApplyCoupon = () => {
    if (couponCode.trim()) {
      applyCouponMutation.mutate(couponCode.trim());
      setCouponCode("");
    }
  };

  const handleCancel = () => {
    cancelMutation.mutate(undefined, {
      onSuccess: () => setCancelDialogOpen(false),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Manage your subscription and billing" />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscription ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{subscription.planName}</span>
                  <Badge variant={STATUS_VARIANT[subscription.status] ?? "default"}>
                    {subscription.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {subscription.cancelAtPeriodEnd
                    ? `Cancels on ${formatDate(subscription.currentPeriodEnd)}`
                    : `Renews on ${formatDate(subscription.currentPeriodEnd)}`}
                </p>
                {subscription.cancelAtPeriodEnd ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resumeMutation.mutate()}
                    disabled={resumeMutation.isPending}
                  >
                    Resume Subscription
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No active subscription</p>
            )}
          </CardContent>
        </Card>

        {/* Coupon Redemption */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Redeem Coupon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="coupon-code" className="sr-only">
                  Coupon Code
                </Label>
                <Input
                  id="coupon-code"
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                />
              </div>
              <Button
                onClick={handleApplyCoupon}
                disabled={!couponCode.trim() || applyCouponMutation.isPending}
              >
                {applyCouponMutation.isPending ? "Applying..." : "Apply"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Bars */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <UsageBar label="Students" used={usage.students.used} limit={usage.students.limit} />
              <UsageBar label="Exams" used={usage.exams.used} limit={usage.exams.limit} />
              <UsageBar
                label="AI Credits"
                used={usage.aiCredits.used}
                limit={usage.aiCredits.limit}
              />
              <UsageBar
                label="Storage"
                used={usage.storage.usedMb}
                limit={usage.storage.limitMb}
                unit="MB"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices && invoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="text-sm">
                      {invoice.paidAt ? formatDate(invoice.paidAt) : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === "paid" ? "success" : "warning"}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <a href={invoice.downloadUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-1 h-4 w-4" />
                          PDF
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={CreditCard}
              title="No invoices"
              description="Invoices will appear here after your first payment"
            />
          )}
        </CardContent>
      </Card>

      {/* Cancel/Downgrade Section */}
      {subscription && !subscription.cancelAtPeriodEnd && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Cancel Subscription</p>
                <p className="text-xs text-muted-foreground">
                  Your plan will remain active until the end of the current billing period.
                </p>
              </div>
              <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Cancel Plan
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Subscription?</DialogTitle>
                    <DialogDescription>
                      Your plan will remain active until {formatDate(subscription.currentPeriodEnd)}
                      . After that, you will lose access to premium features.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <p className="text-sm text-destructive">
                      This action cannot be undone immediately.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                      Keep Plan
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? "Canceling..." : "Confirm Cancel"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Usage Bar Component ────────────────────────────────────────────────────

function UsageBar({
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
  const isWarning = percent >= 80;
  const isCritical = percent >= 95;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {formatNumber(used)} / {formatNumber(limit)} {unit ?? ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isCritical ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-primary"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
