import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { describeRuns, subscribeToRuns, type TaskRun } from "@/lib/tasks/runs";
import { cn } from "@/lib/utils";

/**
 * "OCADE is still doing something, and it is not on this screen."
 *
 * A task the user is watching needs no badge — the panel in front of them is
 * already the status. This appears only once they have navigated away from it,
 * which is the moment "is that still running?" becomes a real question with no
 * answer anywhere else in the product.
 *
 * It says how many and what kind, never which model, file or engine: the words
 * come from the imported task label so the pill and the task list cannot drift
 * into describing the same work two different ways.
 */
export function RunningTasksPill({ className }: { className?: string }) {
  const [runs, setRuns] = useState<TaskRun[]>([]);

  useEffect(() => subscribeToRuns(setRuns), []);

  const { label, needsAttention } = describeRuns(runs);
  if (!label) return null;

  return (
    <Link
      to="/ocade/tasks"
      aria-label={
        needsAttention
          ? `${label} — paused and waiting for you. Open tasks.`
          : `${label} running in the background. Open tasks.`
      }
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          needsAttention
            ? "bg-[color:var(--state-warning)]"
            : "animate-pulse bg-primary motion-reduce:animate-none",
        )}
      />
      <span className="max-w-32 truncate">{needsAttention ? `${label} paused` : label}</span>
    </Link>
  );
}
