import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Building } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { OrgTabs } from "../components/org-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useBranches } from "../api/queries";
import {
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useDeleteBranchMutation,
} from "../api/mutations";
import { branchFormSchema, type BranchFormValues, type Branch } from "../schemas/org-schemas";
import { useAuthStore } from "@/store/auth-store";
import { useTenantContextStore } from "@/store/tenant-context-store";
import { useTenants } from "@/features/admin/api/queries";

export default function BranchesPage() {
  const role = useAuthStore((s) => s.user?.role);
  const impersonatedTenantId = useTenantContextStore((s) => s.impersonatedTenantId);
  const isGodView = role === "SUPER_ADMIN" && !impersonatedTenantId;

  const [tenantId, setTenantId] = useState<string | undefined>(undefined);

  const { data: tenantsData } = useTenants({ pageSize: 100 }, { enabled: isGodView });
  const tenants = tenantsData?.data ?? [];

  const {
    data: branches,
    isLoading,
    isError,
    refetch,
  } = useBranches(isGodView ? { tenantId } : undefined);
  const createMutation = useCreateBranchMutation();
  const updateMutation = useUpdateBranchMutation();
  const deleteMutation = useDeleteBranchMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState<Branch | null>(null);

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: { name: "", code: "", address: "", isActive: true },
  });

  function openCreate() {
    form.reset({ name: "", code: "", address: "", isActive: true });
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(branch: Branch) {
    form.reset({
      name: branch.name,
      code: branch.code || "",
      address: branch.address || "",
      isActive: branch.isActive,
    });
    setEditing(branch);
    setFormOpen(true);
  }

  function onSubmit(data: BranchFormValues) {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id }, { onSuccess: () => setFormOpen(false) });
    } else {
      createMutation.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  }

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <OrgTabs />
      <PageHeader
        title="Branches"
        description="Manage your institute branches"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Branch
          </Button>
        }
      />

      {isGodView && (
        <div className="flex flex-wrap gap-3">
          <Select value={tenantId || ""} onValueChange={(v) => setTenantId(v || undefined)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All institutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All institutes</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {branches?.length === 0 ? (
        <EmptyState
          icon={Building}
          title="No branches yet"
          description="Create your first branch to organize your institute"
          action={{ label: "Add Branch", onClick: openCreate }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches?.map((branch) => (
            <Card key={branch.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{branch.name}</h3>
                    {isGodView && branch.tenantName && (
                      <p className="text-xs text-muted-foreground">
                        Institute: {branch.tenantName}
                      </p>
                    )}
                    {branch.code && (
                      <p className="text-sm text-muted-foreground">Code: {branch.code}</p>
                    )}
                    {branch.address && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {branch.address}
                      </p>
                    )}
                  </div>
                  <Badge variant={branch.isActive ? "success" : "secondary"}>
                    {branch.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(branch)}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleting(branch)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Branch" : "Add Branch"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update branch details" : "Create a new branch for your institute"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Name *</Label>
              <Input id="branch-name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-code">Code</Label>
              <Input id="branch-code" placeholder="e.g. BR-01" {...form.register("code")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-address">Address</Label>
              <Input id="branch-address" {...form.register("address")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Delete Branch"
        description={`Are you sure you want to delete "${deleting?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) {
            deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
          }
        }}
      />
    </div>
  );
}
