import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  type CalendarCell,
  calendarCells,
  isoDate,
  parseIsoDate,
} from "@/components/ui/calendar-grid";

export function OcadeDatePicker({
  id,
  label,
  value,
  onChange,
  endValue,
  onEndChange,
  min,
  max,
  locale = "en-IN",
  includeTime = false,
  time = "09:00",
  onTimeChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  endValue?: string;
  onEndChange?: (value: string) => void;
  min?: string;
  max?: string;
  locale?: string;
  includeTime?: boolean;
  time?: string;
  onTimeChange?: (value: string) => void;
}) {
  const initial = parseIsoDate(value) ?? new Date();
  const [month, setMonth] = useState(
    () => new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth(), 1)),
  );
  const cells = useMemo(() => calendarCells(month), [month]);
  const isRange = Boolean(onEndChange);
  const today = isoDate(new Date());
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    [locale],
  );

  function choose(next: string) {
    if (!isRange) {
      onChange(next);
      return;
    }
    if (!value || (value && endValue)) {
      onChange(next);
      onEndChange?.("");
    } else if (next < value) {
      onChange(next);
      onEndChange?.(value);
    } else {
      onEndChange?.(next);
    }
  }

  function shiftMonth(delta: number) {
    setMonth(
      (current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1)),
    );
  }

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(month);

  return (
    <fieldset className="rounded-xl border border-border/60 bg-background/35 p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">{label}</legend>
      <div className={`grid gap-2 ${isRange ? "sm:grid-cols-2" : ""}`}>
        <label className="text-[11px] text-muted-foreground">
          {isRange ? "Start date" : "Date"}
          <input
            id={id}
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-describedby={`${id}-format`}
            className="mt-1 min-h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm text-foreground"
          />
        </label>
        {isRange ? (
          <label className="text-[11px] text-muted-foreground">
            End date
            <input
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              value={endValue ?? ""}
              onChange={(event) => onEndChange?.(event.target.value)}
              className="mt-1 min-h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm text-foreground"
            />
          </label>
        ) : null}
      </div>
      <p id={`${id}-format`} className="mt-1 text-[10px] text-muted-foreground">
        {parseIsoDate(value)
          ? formatter.format(parseIsoDate(value)!)
          : `Format: YYYY-MM-DD · ${locale}`}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
          className="grid h-9 w-9 place-items-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <span className="text-sm font-medium" aria-live="polite">
          {monthLabel}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
          className="grid h-9 w-9 place-items-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div role="grid" aria-label={`${label} calendar`} className="mt-2 grid grid-cols-7 gap-1">
        {(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const).map((day) => (
          <span
            key={day}
            role="columnheader"
            className="py-1 text-center text-[10px] text-muted-foreground"
          >
            {day}
          </span>
        ))}
        {cells.map((cell) => {
          const disabled = Boolean((min && cell.iso < min) || (max && cell.iso > max));
          const selected = cell.iso === value || cell.iso === endValue;
          const inRange = Boolean(value && endValue && cell.iso > value && cell.iso < endValue);
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              aria-label={cell.iso}
              aria-selected={selected}
              disabled={disabled}
              onClick={() => choose(cell.iso)}
              className={`grid aspect-square min-h-8 place-items-center rounded-md text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-25 ${
                selected
                  ? "bg-primary text-primary-foreground"
                  : inRange
                    ? "bg-primary/15 text-foreground"
                    : cell.inMonth
                      ? "hover:bg-accent"
                      : "text-muted-foreground/45 hover:bg-accent"
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <button
          type="button"
          onClick={() => choose(today)}
          disabled={Boolean((min && today < min) || (max && today > max))}
          className="min-h-9 rounded-md border border-border/70 px-3 text-xs hover:bg-accent disabled:opacity-40"
        >
          Today
        </button>
        {includeTime ? (
          <label className="text-[11px] text-muted-foreground">
            Time
            <input
              type="time"
              value={time}
              onChange={(event) => onTimeChange?.(event.target.value)}
              className="ml-2 min-h-9 rounded-md border border-border/70 bg-background px-2 text-sm text-foreground"
            />
          </label>
        ) : null}
      </div>
    </fieldset>
  );
}
