import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, UserPlus, MoreHorizontal, Mail } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { DataTable } from "@/components/data-table";
import { useTeachers, useUserDetail } from "../api/queries";
import {
  useInviteTeacherMutation,
  useDeactivateUserMutation,
  useActivateUserMutation,
} from "../api/mutations";
import {
  inviteTeacherSchema,
  type InviteTeacherFormValues,
  type UserListItem,
} from "../schemas/user-schemas";
import { UserEditDialog } from "../components/user-edit-dialog";
import { formatRelativeTime, formatDate, getInitials } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";
import { useTenantContextStore } from "@/store/tenant-context-store";
import { useTenants } from "@/features/admin/api/queries";
import type { ColumnDef } from "@tanstack/react-table";

export default function TeachersPage() {
  const role = useAuthStore((s) => s.user?.role);
  const impersonatedTenantId = useTenantContextStore((s) => s.impersonatedTenantId);
  const isGodView = role === "SUPER_ADMIN" && !impersonatedTenantId;

  const [tenantFilter, setTenantFilter] = useState<string>("");
  const { data: tenantsData } = useTenants({ pageSize: 100 }, { enabled: isGodView });
  const tenants = tenantsData?.data ?? [];

  const { data, isLoading, isError, refetch } = useTeachers(
    isGodView && tenantFilter ? { tenantId: tenantFilter } : undefined
  );
  const inviteMutation = useInviteTeacherMutation();
  const deactivateMutation = useDeactivateUserMutation();
  const activateMutation = useActivateUserMutation();
  const [inviteOpen, setInviteOpen] = useState(false);

  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserListItem | null>(null);
  const { data: viewedUser } = useUserDetail(viewUserId ?? "");

  const form = useForm<InviteTeacherFormValues>({
    resolver: zodResolver(inviteTeacherSchema),
    defaultValues: { email: "", firstName: "", lastName: "", role: "TEACHER" },
  });

  function onSubmitInvite(data: InviteTeacherFormValues) {
    inviteMutation.mutate(data, {
      onSuccess: () => {
        setInviteOpen(false);
        form.reset();
      },
    });
  }

  function handleToggleStatus(user: UserListItem) {
    if (user.status === "SUSPENDED") {
      if (!window.confirm(`Reactivate ${user.name}?`)) return;
      activateMutation.mutate(user.id);
    } else {
      if (!window.confirm(`Deactivate ${user.name}? They won't be able to sign in.`)) return;
      deactivateMutation.mutate(user.id);
    }
  }

  const columns: ColumnDef<UserListItem>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {getInitials(row.original.name)}
          </div>
          <div>
            <p className="text-sm font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant="secondary" className="capitalize">
          {row.original.role.toLowerCase().replace(/_/g, " ")}
        </Badge>
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
              <DropdownMenuItem onSelect={() => setViewUserId(user.id)}>
                View Profile
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

  const teachers = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teachers"
        description="Manage teacher accounts and invitations"
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Invite Teacher
          </Button>
        }
      />

      {isGodView && (
        <div className="flex flex-wrap gap-3">
          <Select value={tenantFilter} onValueChange={(v) => setTenantFilter(v)}>
            <SelectTrigger className="w-64">
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

      {teachers.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No teachers yet"
          description={
            isGodView ? "No teachers match this filter." : "Invite teachers to join your institute"
          }
          action={
            isGodView ? undefined : { label: "Invite Teacher", onClick: () => setInviteOpen(true) }
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={teachers}
          searchKey="name"
          searchPlaceholder="Search teachers..."
        />
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Teacher</DialogTitle>
            <DialogDescription>Send an email invitation to join your institute</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmitInvite)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inv-first">First Name *</Label>
                <Input id="inv-first" {...form.register("firstName")} />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-last">Last Name *</Label>
                <Input id="inv-last" {...form.register("lastName")} />
                {form.formState.errors.lastName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-email">Email *</Label>
              <Input
                id="inv-email"
                type="email"
                placeholder="teacher@example.com"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(v) => form.setValue("role", v as "TEACHER" | "ADMIN")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEACHER">Teacher</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
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

      {/* View Profile Sheet */}
      <Sheet open={!!viewUserId} onOpenChange={(o) => !o && setViewUserId(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Profile</SheetTitle>
            <SheetDescription>Account details</SheetDescription>
          </SheetHeader>
          {viewedUser && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4">
                {viewedUser.avatar ? (
                  <img
                    src={viewedUser.avatar}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-medium text-primary">
                    {getInitials(viewedUser.name)}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">{viewedUser.name}</h3>
                  <p className="text-sm text-muted-foreground">{viewedUser.email}</p>
                  <Badge
                    className="mt-1 capitalize"
                    variant={viewedUser.status === "ACTIVE" ? "success" : "secondary"}
                  >
                    {viewedUser.status.toLowerCase()}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Role</p>
                  <p className="font-medium capitalize">
                    {viewedUser.role.toLowerCase().replace(/_/g, " ")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{viewedUser.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Branch</p>
                  <p className="font-medium">{viewedUser.branchName || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last login</p>
                  <p className="font-medium">
                    {viewedUser.lastLogin ? formatRelativeTime(viewedUser.lastLogin) : "Never"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Joined</p>
                  <p className="font-medium">{formatDate(viewedUser.createdAt)}</p>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <UserEditDialog
        user={editUser}
        open={!!editUser}
        onOpenChange={(o) => !o && setEditUser(null)}
      />
    </div>
  );
}
