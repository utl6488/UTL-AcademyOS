import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Upload, MoreHorizontal, Users } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { DataTable } from "@/components/data-table";
import { useStudents, useUserDetail } from "../api/queries";
import { useClasses, useBatches } from "@/features/org/api/queries";
import { formatRelativeTime, formatDate } from "@/lib/format";
import type { UserListItem } from "../schemas/user-schemas";
import type { ColumnDef } from "@tanstack/react-table";

export default function StudentsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<{
    classId?: string;
    batchId?: string;
    status?: string;
    search?: string;
  }>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useStudents(filters);
  const { data: classes } = useClasses();
  const { data: batches } = useBatches(filters.classId ? { classId: filters.classId } : undefined);
  const { data: userDetail } = useUserDetail(selectedUserId || "");

  const columns: ColumnDef<UserListItem>[] = [
    {
      accessorKey: "firstName",
      header: "Student",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.avatar ? (
            <img src={row.original.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {row.original.firstName[0]}
              {row.original.lastName[0]}
            </div>
          )}
          <div>
            <p className="text-sm font-medium">
              {row.original.firstName} {row.original.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "className",
      header: "Class",
      cell: ({ row }) => row.original.className || "—",
    },
    {
      accessorKey: "batchName",
      header: "Batch",
      cell: ({ row }) => row.original.batchName || "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "active"
              ? "success"
              : row.original.status === "pending"
                ? "warning"
                : "secondary"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "lastLogin",
      header: "Last Active",
      cell: ({ row }) =>
        row.original.lastLogin ? formatRelativeTime(row.original.lastLogin) : "Never",
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
            <DropdownMenuItem onClick={() => setSelectedUserId(row.original.id)}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const students = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage student accounts"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/users/import")}>
              <Upload className="mr-2 h-4 w-4" /> Bulk Import
            </Button>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Student
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name or email..."
          className="w-64"
          value={filters.search || ""}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <Select
          value={filters.classId || ""}
          onValueChange={(v) =>
            setFilters((f) => ({ ...f, classId: v || undefined, batchId: undefined }))
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All classes</SelectItem>
            {classes?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.batchId || ""}
          onValueChange={(v) => setFilters((f) => ({ ...f, batchId: v || undefined }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All batches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All batches</SelectItem>
            {batches?.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status || ""}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v || undefined }))}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {students.length === 0 && !filters.search ? (
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Add students or bulk import from a CSV file"
          action={{ label: "Bulk Import", onClick: () => navigate("/users/import") }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={students}
          searchKey="firstName"
          searchPlaceholder="Search in results..."
        />
      )}

      {/* User Detail Drawer */}
      <Sheet open={!!selectedUserId} onOpenChange={() => setSelectedUserId(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Student Details</SheetTitle>
            <SheetDescription>View student profile and assignments</SheetDescription>
          </SheetHeader>
          {userDetail && (
            <div className="mt-6 space-y-6">
              {/* Profile */}
              <div className="flex items-center gap-4">
                {userDetail.avatar ? (
                  <img
                    src={userDetail.avatar}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-medium text-primary">
                    {userDetail.firstName[0]}
                    {userDetail.lastName[0]}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">
                    {userDetail.firstName} {userDetail.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">{userDetail.email}</p>
                  <Badge
                    className="mt-1"
                    variant={userDetail.status === "active" ? "success" : "secondary"}
                  >
                    {userDetail.status}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Assignments */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Assignments</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Class</p>
                    <p className="font-medium">{userDetail.className || "Not assigned"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Batch</p>
                    <p className="font-medium">{userDetail.batchName || "Not assigned"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Section</p>
                    <p className="font-medium">{userDetail.sectionName || "Not assigned"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Stats */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Activity</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Exams Taken</p>
                    <p className="font-medium">{userDetail.examsTaken}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Score</p>
                    <p className="font-medium">
                      {userDetail.averageScore != null ? `${userDetail.averageScore}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Login</p>
                    <p className="font-medium">
                      {userDetail.lastLogin ? formatRelativeTime(userDetail.lastLogin) : "Never"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Joined</p>
                    <p className="font-medium">{formatDate(userDetail.createdAt)}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate(`/results?studentId=${userDetail.id}`)}
              >
                View Exam History
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
