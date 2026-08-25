import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { OrgTabs } from "../components/org-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { DataTable } from "@/components/data-table";
import { useBatches, useClasses } from "../api/queries";
import {
  useCreateBatchMutation,
  useUpdateBatchMutation,
  useDeleteBatchMutation,
} from "../api/mutations";
import { batchFormSchema, type BatchFormValues, type Batch } from "../schemas/org-schemas";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuthStore } from "@/store/auth-store";
import { useTenantContextStore } from "@/store/tenant-context-store";
import { useTenants } from "@/features/admin/api/queries";

export default function BatchesPage() {
  const role = useAuthStore((s) => s.user?.role);
  const impersonatedTenantId = useTenantContextStore((s) => s.impersonatedTenantId);
  const isGodView = role === "SUPER_ADMIN" && !impersonatedTenantId;

  const [tenantId, setTenantId] = useState<string | undefined>(undefined);

  const { data: tenantsData } = useTenants({ pageSize: 100 }, { enabled: isGodView });
  const tenants = tenantsData?.data ?? [];

  const {
    data: batches,
    isLoading,
    isError,
    refetch,
  } = useBatches(isGodView ? { tenantId } : undefined);
  const { data: classes } = useClasses();
  const createMutation = useCreateBatchMutation();
  const updateMutation = useUpdateBatchMutation();
  const deleteMutation = useDeleteBatchMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [deleting, setDeleting] = useState<Batch | null>(null);

  const form = useForm<BatchFormValues>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: { name: "", classId: "", isActive: true },
  });

  function openCreate() {
    form.reset({ name: "", classId: "", isActive: true });
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(batch: Batch) {
    form.reset({
      name: batch.name,
      classId: batch.classId,
      teacherId: batch.teacherId || undefined,
      isActive: batch.isActive,
    });
    setEditing(batch);
    setFormOpen(true);
  }

  function onSubmit(data: BatchFormValues) {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id }, { onSuccess: () => setFormOpen(false) });
    } else {
      createMutation.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  }

  const baseColumns: ColumnDef<Batch>[] = [
    { accessorKey: "name", header: "Batch Name" },
    { accessorKey: "className", header: "Class" },
    ...(isGodView
      ? [
          {
            accessorKey: "tenantName",
            header: "Institute",
            cell: ({ row }: { row: { original: Batch } }) => row.original.tenantName || "—",
          } as ColumnDef<Batch>,
        ]
      : []),
    {
      accessorKey: "teacherName",
      header: "Teacher",
      cell: ({ row }) => row.original.teacherName || "—",
    },
    { accessorKey: "studentCount", header: "Students" },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <OrgTabs />
      <PageHeader
        title="Batches"
        description="Manage student batches and assign teachers"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Batch
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

      {batches?.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No batches yet"
          description="Create batches to group students within classes"
          action={{ label: "Add Batch", onClick: openCreate }}
        />
      ) : (
        <DataTable
          columns={[
            ...baseColumns,
            {
              id: "actions",
              cell: ({ row }) => (
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => setDeleting(row.original)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ),
            },
          ]}
          data={batches ?? []}
          searchKey="name"
          searchPlaceholder="Search batches..."
          emptyMessage="No batches found"
          emptyAction={{ label: "Add Batch", onClick: openCreate }}
        />
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Batch" : "Add Batch"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update batch details" : "Create a new batch"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-name">Batch Name *</Label>
              <Input
                id="batch-name"
                placeholder="e.g. Batch A - Morning"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select
                value={form.watch("classId")}
                onValueChange={(v) => form.setValue("classId", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.classId && (
                <p className="text-xs text-destructive">{form.formState.errors.classId.message}</p>
              )}
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

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Delete Batch"
        description={`Are you sure you want to delete "${deleting?.name}"? Students won't be deleted but will be unassigned.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
