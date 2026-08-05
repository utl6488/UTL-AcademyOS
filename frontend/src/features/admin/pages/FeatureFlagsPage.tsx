import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Flag } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useFeatureFlags } from "../api/queries";
import {
  useToggleFeatureFlagMutation,
  useCreateFeatureFlagMutation,
  useDeleteFeatureFlagMutation,
} from "../api/mutations";
import {
  createFeatureFlagRequestSchema,
  type CreateFeatureFlagRequest,
} from "../schemas/admin-schemas";
import { formatPercent } from "@/lib/format";

export default function FeatureFlagsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: flags, isLoading, isError, refetch } = useFeatureFlags();
  const toggleMutation = useToggleFeatureFlagMutation();
  const createMutation = useCreateFeatureFlagMutation();
  const deleteMutation = useDeleteFeatureFlagMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFeatureFlagRequest>({
    resolver: zodResolver(createFeatureFlagRequestSchema),
    defaultValues: {
      key: "",
      description: "",
      rolloutPercentage: 100,
    },
  });

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const onCreateFlag = (data: CreateFeatureFlagRequest) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        setCreateOpen(false);
        reset();
      },
    });
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget, {
        onSuccess: () => setDeleteTarget(null),
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Flags"
        description="Manage feature rollouts and toggles"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Flag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Feature Flag</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onCreateFlag)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="flag-key">Key</Label>
                  <Input id="flag-key" placeholder="e.g. enable-ai-grading" {...register("key")} />
                  {errors.key && <p className="text-sm text-destructive">{errors.key.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flag-desc">Description</Label>
                  <Input
                    id="flag-desc"
                    placeholder="What does this flag control?"
                    {...register("description")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flag-rollout">Rollout Percentage</Label>
                  <Input
                    id="flag-rollout"
                    type="number"
                    min={0}
                    max={100}
                    {...register("rolloutPercentage")}
                  />
                  {errors.rolloutPercentage && (
                    <p className="text-sm text-destructive">{errors.rolloutPercentage.message}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {flags && flags.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Rollout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell className="font-mono text-sm">{flag.key}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {flag.description}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatPercent(flag.rolloutPercentage, 0)}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() =>
                          toggleMutation.mutate({ id: flag.id, enabled: !flag.enabled })
                        }
                        disabled={toggleMutation.isPending}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{
                          backgroundColor: flag.enabled
                            ? "hsl(var(--primary))"
                            : "hsl(var(--muted))",
                        }}
                        role="switch"
                        aria-checked={flag.enabled}
                        aria-label={`Toggle ${flag.key}`}
                      >
                        <span
                          className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                          style={{
                            transform: flag.enabled
                              ? "translateX(1.375rem)"
                              : "translateX(0.25rem)",
                          }}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(flag.id)}
                        aria-label={`Delete ${flag.key}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Flag}
          title="No feature flags"
          description="Create your first feature flag to control feature rollouts"
          action={{ label: "New Flag", onClick: () => setCreateOpen(true) }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Feature Flag"
        description="Are you sure you want to delete this feature flag? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
