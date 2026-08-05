import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MoreHorizontal, FileQuestion, Download, Upload } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useQuestions, type QuestionFilters } from "../api/queries";
import { useDeleteQuestionMutation, useBulkExportQuestionsMutation } from "../api/mutations";
import { useSubjects, useTopics } from "@/features/org/api/queries";
import type { QuestionListItem, QuestionType, Difficulty } from "../schemas/question-schemas";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: "MCQ",
  MSQ: "MSQ",
  TRUE_FALSE: "True/False",
  FILL_BLANK: "Fill in Blank",
  NUMERICAL: "Numerical",
  SHORT_ANSWER: "Short Answer",
  LONG_ANSWER: "Long Answer",
  IMAGE_BASED: "Image Based",
};

const DIFFICULTY_VARIANT: Record<Difficulty, "success" | "warning" | "destructive"> = {
  easy: "success",
  medium: "warning",
  hard: "destructive",
};

export default function QuestionListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<QuestionFilters>({});

  const { data, isLoading, isError, refetch } = useQuestions(filters);
  const { data: subjects } = useSubjects();
  const { data: topics } = useTopics(filters.subjectId || "");
  const deleteMutation = useDeleteQuestionMutation();
  const exportMutation = useBulkExportQuestionsMutation();

  const columns: ColumnDef<QuestionListItem>[] = [
    {
      accessorKey: "text",
      header: "Question",
      cell: ({ row }) => (
        <p className="max-w-[300px] truncate text-sm font-medium">{row.original.text}</p>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="secondary">{QUESTION_TYPE_LABELS[row.original.type]}</Badge>
      ),
    },
    {
      accessorKey: "subjectName",
      header: "Subject",
      cell: ({ row }) => <span className="text-sm">{row.original.subjectName}</span>,
    },
    {
      accessorKey: "topicName",
      header: "Topic",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.topicName || "—"}</span>
      ),
    },
    {
      accessorKey: "difficulty",
      header: "Difficulty",
      cell: ({ row }) => (
        <Badge variant={DIFFICULTY_VARIANT[row.original.difficulty]}>
          {row.original.difficulty}
        </Badge>
      ),
    },
    {
      accessorKey: "marks",
      header: "Marks",
      cell: ({ row }) => <span className="text-sm">{row.original.marks}</span>,
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
            <DropdownMenuItem onClick={() => navigate(`/questions/${row.original.id}`)}>
              View / Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate(`/questions/${row.original.id}?duplicate=true`)}
            >
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => deleteMutation.mutate(row.original.id)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const questions = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question Bank"
        description="Create and manage exam questions"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => exportMutation.mutate(filters)}
              disabled={exportMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" onClick={() => navigate("/questions/import")}>
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
            <Button onClick={() => navigate("/questions/new")}>
              <Plus className="mr-2 h-4 w-4" /> Add Question
            </Button>
          </div>
        }
      />

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search questions..."
          className="w-64"
          value={filters.search || ""}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <Select
          value={filters.subjectId || ""}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, subjectId: v || undefined, topicId: undefined }))
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All subjects</SelectItem>
            {subjects?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.topicId || ""}
          onValueChange={(v) => setFilters((f) => ({ ...f, topicId: v || undefined }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All topics</SelectItem>
            {topics?.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.difficulty || ""}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, difficulty: (v as Difficulty) || undefined }))
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All levels</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.type || ""}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, type: (v as QuestionType) || undefined }))
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
            {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table or Empty State */}
      {questions.length === 0 && !filters.search && !filters.subjectId ? (
        <EmptyState
          icon={FileQuestion}
          title="No questions yet"
          description="Create your first question or import a batch from a file"
          action={{ label: "Add Question", onClick: () => navigate("/questions/new") }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={questions}
          searchKey="text"
          searchPlaceholder="Filter results..."
          emptyMessage="No questions match your filters"
        />
      )}
    </div>
  );
}
