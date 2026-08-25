import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClasses, useBatches } from "@/features/org/api/queries";
import { useUpdateUserMutation } from "../api/mutations";
import type { UserListItem } from "../schemas/user-schemas";

interface Props {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserEditDialog({ user, open, onOpenChange }: Props) {
  const isStudent = user?.role === "STUDENT";
  const { data: classes } = useClasses();
  const updateMutation = useUpdateUserMutation();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");

  const { data: batches } = useBatches(classId ? { classId } : undefined);

  useEffect(() => {
    if (open && user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setClassId(user.classId ?? "");
      setBatchId(user.batchId ?? "");
    }
  }, [open, user]);

  if (!user) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const patch: Record<string, unknown> = {};
    if (name.trim() && name.trim() !== user.name) patch.name = name.trim();
    const trimmedPhone = phone.trim();
    if (trimmedPhone !== (user.phone ?? "")) patch.phone = trimmedPhone || null;
    if (isStudent && (classId || null) !== (user.classId ?? null)) {
      patch.classId = classId || null;
    }
    if (isStudent && (batchId || null) !== (user.batchId ?? null)) {
      patch.batchId = batchId || null;
    }
    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }
    updateMutation.mutate({ id: user.id, ...patch }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {isStudent ? "Student" : "User"}</DialogTitle>
          <DialogDescription>Update profile details for {user.email}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              placeholder="Optional"
            />
          </div>
          {isStudent && (
            <>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select
                  value={classId}
                  onValueChange={(v) => {
                    setClassId(v);
                    setBatchId("");
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
                    No classes exist yet. Create one under Organization → Classes.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Batch</Label>
                <Select
                  value={batchId}
                  onValueChange={(v) => setBatchId(v)}
                  disabled={!batches || batches.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !classId
                          ? "Select a class first"
                          : batches?.length
                            ? "Unassigned"
                            : "No batches in this class"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {batches?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
