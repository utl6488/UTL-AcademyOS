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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { DataTable } from "@/components/data-table";
import { useTeachers } from "../api/queries";
import { useInviteTeacherMutation } from "../api/mutations";
import {
  inviteTeacherSchema,
  type InviteTeacherFormValues,
  type UserListItem,
} from "../schemas/user-schemas";
import { formatRelativeTime } from "@/lib/format";
import type { ColumnDef } from "@tanstack/react-table";

export default function TeachersPage() {
  const { data, isLoading, isError, refetch } = useTeachers();
  const inviteMutation = useInviteTeacherMutation();
  const [inviteOpen, setInviteOpen] = useState(false);

  const form = useForm<InviteTeacherFormValues>({
    resolver: zodResolver(inviteTeacherSchema),
    defaultValues: { email: "", firstName: "", lastName: "", role: "teacher" },
  });

  function onSubmitInvite(data: InviteTeacherFormValues) {
    inviteMutation.mutate(data, {
      onSuccess: () => {
        setInviteOpen(false);
        form.reset();
      },
    });
  }

  const columns: ColumnDef<UserListItem>[] = [
    {
      accessorKey: "firstName",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {row.original.firstName[0]}
            {row.original.lastName[0]}
          </div>
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
      accessorKey: "roles",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant="secondary" className="capitalize">
          {row.original.roles[0]}
        </Badge>
      ),
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
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View Profile</DropdownMenuItem>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
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

      {teachers.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No teachers yet"
          description="Invite teachers to join your institute"
          action={{ label: "Invite Teacher", onClick: () => setInviteOpen(true) }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={teachers}
          searchKey="firstName"
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
                onValueChange={(v) => form.setValue("role", v as "teacher" | "admin")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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
    </div>
  );
}
