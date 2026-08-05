import { Clock, User } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { useQuestionVersions } from "../api/queries";
import { formatRelativeTime } from "@/lib/format";
import type { QuestionVersion } from "../schemas/question-schemas";

interface VersionHistoryDrawerProps {
  questionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionHistoryDrawer({
  questionId,
  open,
  onOpenChange,
}: VersionHistoryDrawerProps) {
  const { data: versions, isLoading } = useQuestionVersions(open ? questionId : "");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
          <SheetDescription>Track changes made to this question over time</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading && <LoadingSkeleton variant="card" />}

          {!isLoading && (!versions || versions.length === 0) && (
            <EmptyState
              icon={Clock}
              title="No version history"
              description="Changes to this question will appear here"
            />
          )}

          {versions?.map((version, index) => (
            <VersionCard key={version.id} version={version} isLatest={index === 0} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function VersionCard({ version, isLatest }: { version: QuestionVersion; isLatest: boolean }) {
  const diffEntries = Object.entries(version.diff);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={isLatest ? "default" : "secondary"}>v{version.version}</Badge>
          {isLatest && <span className="text-xs text-muted-foreground">Current</span>}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(version.changedAt)}
        </span>
      </div>

      {/* Changed By */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <User className="h-3.5 w-3.5" />
        <span>{version.changedBy}</span>
      </div>

      {/* Diff */}
      {diffEntries.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Changes
            </p>
            {diffEntries.map(([field, change]) => (
              <DiffItem
                key={field}
                field={field}
                change={change as { old: unknown; new: unknown }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DiffItem({ field, change }: { field: string; change: { old: unknown; new: unknown } }) {
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return value ? "True" : "False";
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.join(", ");
    return JSON.stringify(value);
  };

  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium capitalize">{field.replace(/([A-Z])/g, " $1").trim()}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded bg-destructive/10 px-2 py-1">
          <span className="text-destructive line-through">{formatValue(change.old)}</span>
        </div>
        <div className="rounded bg-success/10 px-2 py-1">
          <span className="text-success">{formatValue(change.new)}</span>
        </div>
      </div>
    </div>
  );
}
