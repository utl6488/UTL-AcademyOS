import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Upload, MoreHorizontal, Users, Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { DataTable } from "@/components/data-table";
import { useStudents, useUserDetail } from "../api/queries";
import {
  useInviteStudentMutation,
  useDeactivateUserMutation,
  useActivateUserMutation,
} from "../api/mutations";
import { UserEditDialog } from "../components/user-edit-dialog";
import { useAuthStore } from "@/store/auth-store";
import { useTenantContextStore } from "@/store/tenant-context-store";
import { useTenants } from "@/features/admin/api/queries";
import { useClasses, useBatches } from "@/features/org/api/queries";
import { formatRelativeTime, formatDate, getInitials } from "@/lib/format";
import {
  inviteStudentSchema,
  type InviteStudentFormValues,
  type UserListItem,
} from "../schemas/user-schemas";
import type { ColumnDef } from "@tanstack/react-table";

export default function StudentsPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const impersonatedTenantId = useTenantContextStore((s) => s.impersonatedTenantId);
  const isGodView = role === "SUPER_ADMIN" && !impersonatedTenantId;

  const [filters, setFilters] = useState<{
    classId?: string;
    batchId?: string;
    status?: string;
    search?: string;
    tenantId?: string;
  }>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: tenantsData } = useTenants({ pageSize: 100 }, { enabled: isGodView });
  const tenants = tenantsData?.data ?? [];

  const { data, isLoading, isError, refetch } = useStudents(filters);
  const { data: classes } = useClasses();
  const { data: batches } = useBatches(filters.classId ? { classId: filters.classId } : undefined);
  const { data: userDetail } = useUserDetail(selectedUserId || "");
  const inviteMutation = useInviteStudentMutation();
  const deactivateMutation = useDeactivateUserMutation();
  const activateMutation = useActivateUserMutation();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserListItem | null>(null);

  function handleToggleStatus(user: UserListItem) {
    if (user.status === "SUSPENDED") {
      if (!window.confirm(`Reactivate ${user.name}?`)) return;
      activateMutation.mutate(user.id);
    } else {
      if (!window.confirm(`Deactivate ${user.name}? They won't be able to sign in.`)) return;
      deactivateMutation.mutate(user.id);
    }
  }

  const inviteForm = useForm<InviteStudentFormValues>({
    resolver: zodResolver(inviteStudentSchema),
    defaultValues: { email: "", firstName: "", lastName: "", classId: "", batchId: "" },
  });
  const inviteClassId = inviteForm.watch("classId");
  const { data: inviteBatches } = useBatches(
    inviteClassId ? { classId: inviteClassId } : undefined
  );

  function onSubmitInvite(values: InviteStudentFormValues) {
    inviteMutation.mutate(values, {
      onSuccess: () => {
        setInviteOpen(false);
        inviteForm.reset();
      },
    });
  }

  const columns: ColumnDef<UserListItem>[] = [
    {
      accessorKey: "name",
      header: "Student",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.avatar ? (
            <img src={row.original.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {getInitials(row.original.name)}
            </div>
          )}
          <div>
            <p className="text-sm font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    ...(isGodView
      ? [
          {
            accessorKey: "tenantName",
            header: "Institute",
            cell: ({ row }: { row: { original: UserListItem } }) => row.original.tenantName || "—",
          } as ColumnDef<UserListItem>,
        ]
      : []),
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
            row.original.status === "ACTIVE"
              ? "success"
              : row.original.status === "INVITED"
                ? "warning"
                : "secondary"
          }
          className="capitalize"
        >
          {row.original.status.toLowerCase()}
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
      cell: ({ row }) => {
        const user = row.original;
        const isSuspended = user.status === "SUSPENDED";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSelectedUserId(user.id)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditUser(user)}>Edit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => handleToggleStatus(user)}
                className={isSuspended ? undefined : "text-destructive"}
              >
                {isSuspended ? "Activate" : "Deactivate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
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
            <Button onClick={() => setInviteOpen(true)}>
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
        {isGodView && (
          <Select
            value={filters.tenantId || ""}
            onValueChange={(v) => setFilters((f) => ({ ...f, tenantId: v || undefined }))}
          >
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
        )}
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
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INVITED">Invited</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
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
          searchKey="name"
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
                    {getInitials(userDetail.name)}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">{userDetail.name}</h3>
                  <p className="text-sm text-muted-foreground">{userDetail.email}</p>
                  <Badge
                    className="mt-1 capitalize"
                    variant={userDetail.status === "ACTIVE" ? "success" : "secondary"}
                  >
                    {userDetail.status.toLowerCase()}
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

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Student</DialogTitle>
            <DialogDescription>
              Send an email invitation. The student will set their own password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={inviteForm.handleSubmit(onSubmitInvite)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stu-first">First Name *</Label>
                <Input id="stu-first" {...inviteForm.register("firstName")} />
                {inviteForm.formState.errors.firstName && (
                  <p className="text-xs text-destructive">
                    {inviteForm.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stu-last">Last Name *</Label>
                <Input id="stu-last" {...inviteForm.register("lastName")} />
                {inviteForm.formState.errors.lastName && (
                  <p className="text-xs text-destructive">
                    {inviteForm.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stu-email">Email *</Label>
              <Input
                id="stu-email"
                type="email"
                placeholder="student@example.com"
                {...inviteForm.register("email")}
              />
              {inviteForm.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {inviteForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Class (optional)</Label>
              <Select
                value={inviteForm.watch("classId") || ""}
                onValueChange={(v) => {
                  inviteForm.setValue("classId", v || undefined);
                  inviteForm.setValue("batchId", undefined);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {classes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {classes && classes.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No classes exist yet.{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      setInviteOpen(false);
                      navigate("/org/classes");
                    }}
                  >
                    Create one
                  </button>{" "}
                  to assign this student.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Batch (optional)</Label>
              <Select
                value={inviteForm.watch("batchId") || ""}
                onValueChange={(v) => inviteForm.setValue("batchId", v || undefined)}
                disabled={!inviteBatches || inviteBatches.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !inviteClassId
                        ? "Select a class first"
                        : inviteBatches?.length
                          ? "Unassigned"
                          : "No batches in this class"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {inviteBatches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={inviteMutation.isPending}>
                <Mail className="mr-2 h-4 w-4" /> Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UserEditDialog
        user={editUser}
        open={!!editUser}
        onOpenChange={(o) => !o && setEditUser(null)}
      />
    </div>
  );
}
