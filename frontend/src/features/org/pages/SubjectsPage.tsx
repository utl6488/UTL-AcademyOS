import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, BookOpen, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
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
import { useClasses, useSubjects } from "../api/queries";
import {
  useCreateSubjectMutation,
  useUpdateSubjectMutation,
  useDeleteSubjectMutation,
} from "../api/mutations";
import { subjectFormSchema, type SubjectFormValues, type Subject } from "../schemas/org-schemas";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuthStore } from "@/store/auth-store";
import { useTenantContextStore } from "@/store/tenant-context-store";
import { useTenants } from "@/features/admin/api/queries";

export default function SubjectsPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const impersonatedTenantId = useTenantContextStore((s) => s.impersonatedTenantId);
  const isGodView = role === "SUPER_ADMIN" && !impersonatedTenantId;

  const [tenantId, setTenantId] = useState<string | undefined>(undefined);

  const { data: tenantsData } = useTenants({ pageSize: 100 }, { enabled: isGodView });
  const tenants = tenantsData?.data ?? [];

  const {
    data: subjects,
    isLoading,
    isError,
    refetch,
  } = useSubjects(isGodView ? { tenantId } : undefined);
  const { data: classes } = useClasses();
  const createMutation = useCreateSubjectMutation();
  const updateMutation = useUpdateSubjectMutation();
  const deleteMutation = useDeleteSubjectMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);

  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: { name: "", code: "", classIds: [] },
  });

  function openCreate() {
    form.reset({ name: "", code: "", classIds: [] });
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(subject: Subject) {
    form.reset({ name: subject.name, code: subject.code || "", classIds: subject.classIds });
    setEditing(subject);
    setFormOpen(true);
  }

  function onSubmit(data: SubjectFormValues) {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id }, { onSuccess: () => setFormOpen(false) });
    } else {
      createMutation.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  }

  const baseColumns: ColumnDef<Subject>[] = [
    { accessorKey: "name", header: "Subject" },
    { accessorKey: "code", header: "Code", cell: ({ row }) => row.original.code || "—" },
    ...(isGodView
      ? [
          {
            accessorKey: "tenantName",
            header: "Institute",
            cell: ({ row }: { row: { original: Subject } }) => row.original.tenantName || "—",
          } as ColumnDef<Subject>,
        ]
      : []),
    { accessorKey: "topicCount", header: "Topics" },
    {
      accessorKey: "classIds",
      header: "Classes",
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.classIds.length} class(es)</Badge>
      ),
    },
  ];

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subjects & Topics"
        description="Manage subjects and their topic hierarchy"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Subject
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

      {subjects?.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          description="Create subjects to organize your question bank and exams"
          action={{ label: "Add Subject", onClick: openCreate }}
        />
      ) : (
        <DataTable
          columns={[
            ...baseColumns,
            {
              id: "actions",
              cell: ({ row }) => (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/org/subjects/${row.original.id}/topics`)}
                  >
                    Topics <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
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
          data={subjects ?? []}
          searchKey="name"
          searchPlaceholder="Search subjects..."
          emptyMessage="No subjects found"
          emptyAction={{ label: "Add Subject", onClick: openCreate }}
        />
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Subject" : "Add Subject"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update subject details" : "Create a new subject"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subj-name">Subject Name *</Label>
                <Input id="subj-name" placeholder="e.g. Mathematics" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="subj-code">Code</Label>
                <Input id="subj-code" placeholder="e.g. MATH" {...form.register("code")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Classes</Label>
              {(classes ?? []).length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  No classes yet. Create classes under Organization → Classes first, or leave this
                  empty and attach classes later.
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {(classes ?? []).map((cls) => {
                    const selected = form.watch("classIds") ?? [];
                    const checked = selected.includes(cls.id);
                    return (
                      <label
                        key={cls.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input accent-primary"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selected, cls.id]
                              : selected.filter((id) => id !== cls.id);
                            form.setValue("classIds", next, { shouldDirty: true });
                          }}
                        />
                        <span className="flex-1">{cls.name}</span>
                        {cls.branchName && (
                          <span className="text-xs text-muted-foreground">{cls.branchName}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Optional. Assign later if you'd rather.
              </p>
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
        title="Delete Subject"
        description={`Are you sure you want to delete "${deleting?.name}"? All associated topics and questions will be affected.`}
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
