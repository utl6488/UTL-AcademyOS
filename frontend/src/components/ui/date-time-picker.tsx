import * as React from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ── Value contract ─────────────────────────────────────────────────────────
// Matches native <input type="datetime-local">: "YYYY-MM-DDTHH:mm" in local
// time. Empty string means "no value".

interface DateTimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  disabled?: boolean;
  className?: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function parseValue(v: string): { date: Date | null; hour: number; minute: number } {
  if (!v) return { date: null, hour: 9, minute: 0 };
  const [datePart, timePart = "09:00"] = v.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  if (!y || !m || !d) return { date: null, hour: 9, minute: 0 };
  return { date: new Date(y, m - 1, d), hour: hh || 0, minute: mm || 0 };
}

function toValue(date: Date, hour: number, minute: number): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:${pad(minute)}`;
}

function formatDisplay(v: string): string {
  const { date, hour, minute } = parseValue(v);
  if (!date) return "";
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()} · ${pad(h12)}:${pad(minute)} ${period}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(year, month, i - startOffset + 1));
  }
  return cells;
}

export function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date & time",
  min,
  disabled,
  className,
}: DateTimePickerProps) {
  const parsed = parseValue(value);
  const minParsed = min ? parseValue(min) : null;

  const [open, setOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState(() => (parsed.date ?? new Date()).getFullYear());
  const [viewMonth, setViewMonth] = React.useState(() => (parsed.date ?? new Date()).getMonth());

  // Sync view when opening if the value changed externally
  React.useEffect(() => {
    if (open && parsed.date) {
      setViewYear(parsed.date.getFullYear());
      setViewMonth(parsed.date.getMonth());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cells = React.useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const today = new Date();
  const minDate = minParsed?.date ?? null;

  const setDate = (d: Date) => {
    onChange(toValue(d, parsed.hour, parsed.minute));
  };

  const setHour = (h: number) => {
    const d = parsed.date ?? today;
    onChange(toValue(d, Math.max(0, Math.min(23, h)), parsed.minute));
  };

  const setMinute = (m: number) => {
    const d = parsed.date ?? today;
    onChange(toValue(d, parsed.hour, Math.max(0, Math.min(59, m))));
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const display = formatDisplay(value);
  const h12 = parsed.hour % 12 === 0 ? 12 : parsed.hour % 12;
  const period: "AM" | "PM" = parsed.hour >= 12 ? "PM" : "AM";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start gap-2 font-normal",
            !display && "text-muted-foreground",
            className
          )}
        >
          <Calendar className="h-4 w-4 opacity-70" />
          {display || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        {/* Month header */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <button
            type="button"
            onClick={prevMonth}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-medium">
            {MONTHS[viewMonth]} {viewYear}
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Weekday row */}
        <div className="grid grid-cols-7 gap-1 px-3 pt-3">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1 px-3 pb-3 pt-1">
          {cells.map((d, i) => {
            const isCurrentMonth = d.getMonth() === viewMonth;
            const isSelected = parsed.date ? isSameDay(d, parsed.date) : false;
            const isToday = isSameDay(d, today);
            const isDisabled = minDate
              ? d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
              : false;
            return (
              <button
                key={i}
                type="button"
                disabled={isDisabled}
                onClick={() => setDate(d)}
                className={cn(
                  "flex h-9 items-center justify-center rounded-md text-sm transition-colors",
                  !isCurrentMonth && "text-muted-foreground/40",
                  isCurrentMonth && !isSelected && "hover:bg-accent hover:text-accent-foreground",
                  isToday && !isSelected && "ring-1 ring-inset ring-primary/40",
                  isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                  isDisabled && "cursor-not-allowed opacity-30 hover:bg-transparent"
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>

        {/* Time */}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-3 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Time
          </div>
          <div className="flex items-center gap-1">
            <TimeInput
              value={h12}
              min={1}
              max={12}
              onChange={(n) => {
                const asserted = n === 12 ? 0 : n;
                setHour(period === "PM" ? asserted + 12 : asserted);
              }}
              aria-label="Hour"
            />
            <span className="text-sm font-semibold text-muted-foreground">:</span>
            <TimeInput
              value={parsed.minute}
              min={0}
              max={59}
              onChange={setMinute}
              aria-label="Minute"
            />
            <div className="ml-1 inline-flex overflow-hidden rounded-md border">
              {(["AM", "PM"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    const h = h12 === 12 ? 0 : h12;
                    setHour(p === "PM" ? h + 12 : h);
                  }}
                  className={cn(
                    "px-2 py-1 text-xs font-medium transition-colors",
                    period === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-3 py-2">
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setViewYear(now.getFullYear());
              setViewMonth(now.getMonth());
              onChange(toValue(now, now.getHours(), now.getMinutes()));
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Now
          </button>
          <div className="flex gap-2">
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Done
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimeInput({
  value,
  min,
  max,
  onChange,
  ...rest
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max">) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={pad(value)}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "").slice(-2);
        if (raw === "") return;
        const n = parseInt(raw, 10);
        if (Number.isNaN(n)) return;
        onChange(Math.max(min, Math.min(max, n)));
      }}
      className="h-8 w-9 rounded-md border bg-background text-center text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
      {...rest}
    />
  );
}
