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
import { useSubjects } from "../api/queries";
import {
  useCreateSubjectMutation,
  useUpdateSubjectMutation,
  useDeleteSubjectMutation,
} from "../api/mutations";
import { subjectFormSchema, type SubjectFormValues, type Subject } from "../schemas/org-schemas";
import type { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Subject>[] = [
  { accessorKey: "name", header: "Subject" },
  { accessorKey: "code", header: "Code", cell: ({ row }) => row.original.code || "—" },
  { accessorKey: "topicCount", header: "Topics" },
  {
    accessorKey: "classIds",
    header: "Classes",
    cell: ({ row }) => <Badge variant="secondary">{row.original.classIds.length} class(es)</Badge>,
  },
];

export default function SubjectsPage() {
  const navigate = useNavigate();
  const { data: subjects, isLoading, isError, refetch } = useSubjects();
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
            ...columns,
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
