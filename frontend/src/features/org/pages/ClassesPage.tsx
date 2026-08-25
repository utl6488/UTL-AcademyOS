import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, GraduationCap } from "lucide-react";
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
import { useClasses } from "../api/queries";
import {
  useCreateClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
} from "../api/mutations";
import { classFormSchema, type ClassFormValues, type Class } from "../schemas/org-schemas";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuthStore } from "@/store/auth-store";
import { useTenantContextStore } from "@/store/tenant-context-store";
import { useTenants } from "@/features/admin/api/queries";

export default function ClassesPage() {
  const role = useAuthStore((s) => s.user?.role);
  const impersonatedTenantId = useTenantContextStore((s) => s.impersonatedTenantId);
  const isGodView = role === "SUPER_ADMIN" && !impersonatedTenantId;

  const [tenantId, setTenantId] = useState<string | undefined>(undefined);

  const { data: tenantsData } = useTenants({ pageSize: 100 }, { enabled: isGodView });
  const tenants = tenantsData?.data ?? [];

  const {
    data: classes,
    isLoading,
    isError,
    refetch,
  } = useClasses(isGodView ? { tenantId } : undefined);
  const createMutation = useCreateClassMutation();
  const updateMutation = useUpdateClassMutation();
  const deleteMutation = useDeleteClassMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [deleting, setDeleting] = useState<Class | null>(null);

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: { name: "", numericOrder: 1, sections: ["A"] },
  });

  function openCreate() {
    form.reset({ name: "", numericOrder: (classes?.length ?? 0) + 1, sections: ["A"] });
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(cls: Class) {
    form.reset({
      name: cls.name,
      numericOrder: cls.numericOrder,
      branchId: cls.branchId || undefined,
      sections: cls.sections.map((s) => s.name),
    });
    setEditing(cls);
    setFormOpen(true);
  }

  function onSubmit(data: ClassFormValues) {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id }, { onSuccess: () => setFormOpen(false) });
    } else {
      createMutation.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  }

  const baseColumns: ColumnDef<Class>[] = [
    { accessorKey: "name", header: "Class Name" },
    { accessorKey: "numericOrder", header: "Order" },
    ...(isGodView
      ? [
          {
            accessorKey: "tenantName",
            header: "Institute",
            cell: ({ row }: { row: { original: Class } }) => row.original.tenantName || "—",
          } as ColumnDef<Class>,
        ]
      : []),
    {
      accessorKey: "branchName",
      header: "Branch",
      cell: ({ row }) => row.original.branchName || "All",
    },
    {
      accessorKey: "sections",
      header: "Sections",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.sections.map((s) => (
            <Badge key={s.id} variant="secondary" className="text-xs">
              {s.name}
            </Badge>
          ))}
        </div>
      ),
    },
  ];

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <OrgTabs />
      <PageHeader
        title="Classes & Sections"
        description="Manage academic classes and their sections"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Class
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

      {classes?.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No classes yet"
          description="Create classes and sections for your institute"
          action={{ label: "Add Class", onClick: openCreate }}
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
          data={classes ?? []}
          searchKey="name"
          searchPlaceholder="Search classes..."
          emptyMessage="No classes found"
          emptyAction={{ label: "Add Class", onClick: openCreate }}
        />
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Class" : "Add Class"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update class details and sections" : "Create a new class with sections"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cls-name">Class Name *</Label>
                <Input id="cls-name" placeholder="e.g. Class 10" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-order">Order *</Label>
                <Input
                  id="cls-order"
                  type="number"
                  min={1}
                  {...form.register("numericOrder", { valueAsNumber: true })}
                />
                {form.formState.errors.numericOrder && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.numericOrder.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cls-sections">Sections (comma-separated) *</Label>
              <Input
                id="cls-sections"
                placeholder="A, B, C"
                value={form.watch("sections").join(", ")}
                onChange={(e) => {
                  const sections = e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  form.setValue("sections", sections, { shouldValidate: true });
                }}
              />
              {form.formState.errors.sections && (
                <p className="text-xs text-destructive">{form.formState.errors.sections.message}</p>
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
        title="Delete Class"
        description={`Are you sure you want to delete "${deleting?.name}"? All sections and associated data will be removed.`}
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
