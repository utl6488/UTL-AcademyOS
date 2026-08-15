import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MoreHorizontal, ClipboardList, Radio } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useExams } from "../api/queries";
import {
  useDeleteExamMutation,
  useDuplicateExamMutation,
  useUnpublishExamMutation,
} from "../api/mutations";
import { formatDateTime } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";
import type { ExamListItem, ExamStatus } from "../schemas/exam-schemas";

const STATUS_BADGE: Record<
  ExamStatus,
  { variant: "default" | "secondary" | "success" | "warning" | "destructive"; label: string }
> = {
  draft: { variant: "secondary", label: "Draft" },
  scheduled: { variant: "warning", label: "Scheduled" },
  live: { variant: "success", label: "Live" },
  completed: { variant: "default", label: "Completed" },
  cancelled: { variant: "destructive", label: "Cancelled" },
};

export default function ExamListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>("all");
  const statusFilter = tab === "all" ? undefined : (tab as ExamStatus);

  const canManage = useAuthStore((s) => s.hasPermission("exam:manage"));

  const { data, isLoading, isError, refetch } = useExams({ status: statusFilter });
  const deleteMutation = useDeleteExamMutation();
  const duplicateMutation = useDuplicateExamMutation();
  const unpublishMutation = useUnpublishExamMutation();
  const [deleting, setDeleting] = useState<ExamListItem | null>(null);

  const columns: ColumnDef<ExamListItem>[] = [
    {
      accessorKey: "title",
      header: "Exam",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.questionsCount} questions · {row.original.totalMarks} marks ·{" "}
            {row.original.durationMinutes} min
          </p>
        </div>
      ),
    },
    {
      accessorKey: "mode",
      header: "Mode",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.mode === "SYNCHRONOUS" ? "Live" : "Flexible"}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const config = STATUS_BADGE[row.original.status];
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
    },
    {
      accessorKey: "startAt",
      header: "Schedule",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.startAt ? formatDateTime(row.original.startAt) : "Not set"}
        </span>
      ),
    },
    {
      accessorKey: "activeAttempts",
      header: "Active",
      cell: ({ row }) =>
        row.original.status === "live" && row.original.mode === "SYNCHRONOUS" ? (
          <div className="flex items-center gap-1">
            <Radio className="h-3 w-3 animate-pulse text-success" />
            <span className="text-sm font-medium">{row.original.activeAttempts}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/exams/${row.original.id}`)}>
              {canManage && row.original.status === "draft" ? "Edit" : "View Details"}
            </DropdownMenuItem>
            {row.original.status === "live" && row.original.mode === "SYNCHRONOUS" && canManage && (
              <DropdownMenuItem onClick={() => navigate(`/exams/${row.original.id}/live-console`)}>
                Live Console
              </DropdownMenuItem>
            )}
            {canManage && (
              <DropdownMenuItem onClick={() => duplicateMutation.mutate(row.original.id)}>
                Duplicate
              </DropdownMenuItem>
            )}
            {canManage &&
              (row.original.status === "scheduled" || row.original.status === "live") && (
                <DropdownMenuItem onClick={() => unpublishMutation.mutate(row.original.id)}>
                  Unpublish
                </DropdownMenuItem>
              )}
            {canManage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleting(row.original)}
                >
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const exams = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams"
        description={
          canManage ? "Create, schedule, and manage exams" : "View exams assigned to you"
        }
        actions={
          canManage ? (
            <Button onClick={() => navigate("/exams/new")}>
              <Plus className="mr-2 h-4 w-4" /> Create Exam
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {canManage && <TabsTrigger value="draft">Draft</TabsTrigger>}
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {exams.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={tab === "all" ? "No exams yet" : `No ${tab} exams`}
              description={
                tab === "all"
                  ? canManage
                    ? "Create your first exam to get started"
                    : "You'll see exams here once your instructor publishes them."
                  : undefined
              }
              action={
                canManage && tab === "all"
                  ? { label: "Create Exam", onClick: () => navigate("/exams/new") }
                  : undefined
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={exams}
              searchKey="title"
              searchPlaceholder="Search exams..."
            />
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Delete Exam"
        description={`Are you sure you want to delete "${deleting?.title}"? This cannot be undone.`}
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
