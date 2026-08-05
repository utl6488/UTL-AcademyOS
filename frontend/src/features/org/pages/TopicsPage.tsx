import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "react-router-dom";
import { Plus, Pencil, Trash2, FolderTree, ChevronRight, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useTopics } from "../api/queries";
import {
  useCreateTopicMutation,
  useUpdateTopicMutation,
  useDeleteTopicMutation,
} from "../api/mutations";
import { topicFormSchema, type TopicFormValues, type Topic } from "../schemas/org-schemas";
import { cn } from "@/lib/utils";

function TopicTreeItem({
  topic,
  level = 0,
  onEdit,
  onDelete,
  onAddChild,
}: {
  topic: Topic;
  level?: number;
  onEdit: (topic: Topic) => void;
  onDelete: (topic: Topic) => void;
  onAddChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = topic.children && topic.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted/50",
          level > 0 && "ml-6"
        )}
      >
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="h-4 w-4" />
          )}
        </button>
        <FolderTree className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium">{topic.name}</span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onAddChild(topic.id)}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(topic)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => onDelete(topic)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {topic.children!.map((child) => (
            <TopicTreeItem
              key={child.id}
              topic={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopicsPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { data: topics, isLoading, isError, refetch } = useTopics(subjectId!);
  const createMutation = useCreateTopicMutation();
  const updateMutation = useUpdateTopicMutation();
  const deleteMutation = useDeleteTopicMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [deleting, setDeleting] = useState<Topic | null>(null);
  const [parentId, setParentId] = useState<string | undefined>(undefined);

  const form = useForm<TopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: { name: "", subjectId: subjectId!, parentId: undefined },
  });

  function openCreate(parent?: string) {
    form.reset({ name: "", subjectId: subjectId!, parentId: parent });
    setParentId(parent);
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(topic: Topic) {
    form.reset({
      name: topic.name,
      subjectId: topic.subjectId,
      parentId: topic.parentId || undefined,
    });
    setEditing(topic);
    setFormOpen(true);
  }

  function onSubmit(data: TopicFormValues) {
    if (editing) {
      updateMutation.mutate({ ...data, id: editing.id }, { onSuccess: () => setFormOpen(false) });
    } else {
      createMutation.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  }

  if (isLoading) return <LoadingSkeleton variant="card" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Organization", href: "/org" },
          { label: "Subjects", href: "/org/subjects" },
          { label: "Topics" },
        ]}
      />

      <PageHeader
        title="Topics"
        description="Manage the topic hierarchy for this subject"
        actions={
          <Button onClick={() => openCreate()}>
            <Plus className="mr-2 h-4 w-4" /> Add Topic
          </Button>
        }
      />

      {topics?.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No topics yet"
          description="Create topics to organize questions within this subject"
          action={{ label: "Add Topic", onClick: () => openCreate() }}
        />
      ) : (
        <div className="rounded-md border p-2">
          {topics?.map((topic) => (
            <TopicTreeItem
              key={topic.id}
              topic={topic}
              onEdit={openEdit}
              onDelete={setDeleting}
              onAddChild={(pid) => openCreate(pid)}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Topic" : "Add Topic"}</DialogTitle>
            <DialogDescription>
              {parentId
                ? "Adding a sub-topic"
                : editing
                  ? "Update topic name"
                  : "Create a new top-level topic"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic-name">Topic Name *</Label>
              <Input id="topic-name" placeholder="e.g. Algebra" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
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
        title="Delete Topic"
        description={`Are you sure you want to delete "${deleting?.name}"? All sub-topics will also be removed.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) {
            deleteMutation.mutate(
              { id: deleting.id, subjectId: deleting.subjectId },
              { onSuccess: () => setDeleting(null) }
            );
          }
        }}
      />
    </div>
  );
}
