import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuestions } from "@/features/question-bank/api/queries";
import type { QuestionListItem } from "@/features/question-bank/schemas/question-schemas";

interface PickedQuestion {
  questionId: string;
  questionText: string;
  questionType: string;
  marks: number;
}

interface QuestionPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds?: string[];
  onConfirm: (picked: PickedQuestion[]) => void;
}

export function QuestionPickerDialog({
  open,
  onOpenChange,
  excludeIds = [],
  onConfirm,
}: QuestionPickerDialogProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<Record<string, QuestionListItem>>({});

  const { data, isLoading, isError } = useQuestions({
    page: 1,
    pageSize: 50,
    search: debouncedSearch || undefined,
  });

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const questions = (data?.data ?? []).filter((q) => !excluded.has(q.id));

  function toggle(q: QuestionListItem) {
    setSelected((s) => {
      const next = { ...s };
      if (next[q.id]) delete next[q.id];
      else next[q.id] = q;
      return next;
    });
  }

  function handleConfirm() {
    const picked: PickedQuestion[] = Object.values(selected).map((q) => ({
      questionId: q.id,
      questionText: q.text,
      questionType: q.type,
      marks: q.marks,
    }));
    onConfirm(picked);
    setSelected({});
    setSearch("");
    onOpenChange(false);
  }

  function handleCancel() {
    setSelected({});
    setSearch("");
    onOpenChange(false);
  }

  const selectedCount = Object.keys(selected).length;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleCancel())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add questions from bank</DialogTitle>
          <DialogDescription>
            Pick one or more questions to include in this section.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search question text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto rounded-md border">
          {isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>}
          {isError && (
            <p className="p-6 text-center text-sm text-destructive">
              Couldn't load questions. Try again.
            </p>
          )}
          {!isLoading && !isError && questions.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {debouncedSearch
                ? "No questions match that search."
                : "No questions available. Create some in the Question Bank first."}
            </p>
          )}
          {questions.map((q) => {
            const isSelected = !!selected[q.id];
            return (
              <label
                key={q.id}
                className="flex cursor-pointer items-start gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-accent"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-input accent-primary"
                  checked={isSelected}
                  onChange={() => toggle(q)}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="line-clamp-2">{q.text}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {q.type}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {q.difficulty}
                    </Badge>
                    <span>{q.subjectName}</span>
                    {q.topicName && <span>· {q.topicName}</span>}
                    <span className="ml-auto">{q.marks} marks</span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selectedCount} selected
            {excluded.size > 0 && ` · ${excluded.size} already in section`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={selectedCount === 0}>
              Add {selectedCount > 0 && `(${selectedCount})`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
