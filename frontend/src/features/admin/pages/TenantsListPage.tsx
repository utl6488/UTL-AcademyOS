import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Building2 } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useTenants, type TenantFilters } from "../api/queries";
import { useSuspendTenantMutation, useReactivateTenantMutation } from "../api/mutations";
import type { Tenant } from "../schemas/admin-schemas";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive"> = {
  active: "success",
  trialing: "default",
  suspended: "destructive",
  canceled: "warning",
};

export default function TenantsListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<TenantFilters>({});

  const { data, isLoading, isError, refetch } = useTenants(filters);
  const suspendMutation = useSuspendTenantMutation();
  const reactivateMutation = useReactivateTenantMutation();

  const columns: ColumnDef<Tenant>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.slug}</p>
        </div>
      ),
    },
    {
      accessorKey: "planName",
      header: "Plan",
      cell: ({ row }) => <Badge variant="secondary">{row.original.planName}</Badge>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? "default"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "usersCount",
      header: "Users",
      cell: ({ row }) => <span className="text-sm">{formatNumber(row.original.usersCount)}</span>,
    },
    {
      accessorKey: "revenue",
      header: "Revenue",
      cell: ({ row }) => (
        <span className="text-sm font-medium">{formatCurrency(row.original.revenue)}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/admin/tenants/${row.original.id}`)}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.original.status === "active" ? (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => suspendMutation.mutate(row.original.id)}
              >
                Suspend
              </DropdownMenuItem>
            ) : row.original.status === "suspended" ? (
              <DropdownMenuItem onClick={() => reactivateMutation.mutate(row.original.id)}>
                Reactivate
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const tenants = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description="Manage all registered tenants" />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search tenants..."
          className="w-64"
          value={filters.search || ""}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <Select
          value={filters.status || ""}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v || undefined }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.plan || ""}
          onValueChange={(v) => setFilters((f) => ({ ...f, plan: v || undefined }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tenants.length === 0 && !filters.search ? (
        <EmptyState
          icon={Building2}
          title="No tenants"
          description="Tenants will appear here once they sign up"
        />
      ) : (
        <DataTable
          columns={columns}
          data={tenants}
          searchKey="name"
          searchPlaceholder="Filter results..."
          emptyMessage="No tenants match your filters"
        />
      )}
    </div>
  );
}
