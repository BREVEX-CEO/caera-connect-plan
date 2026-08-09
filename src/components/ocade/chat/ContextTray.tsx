import { FileText, FolderOpen, Brain, AlertTriangle, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  describeEntry,
  summariseTray,
  type ContextEntry,
  type ContextOrigin,
} from "@/lib/chat/context-tray";

/**
 * What OCADE will read, shown before the question is sent.
 *
 * Placed above the composer rather than below the reply, because that is the
 * only position where the information is still actionable. A note under the
 * answer explains what happened; this lets the user change it.
 *
 * Every row states its treatment — read whole, searched, or unreadable — so
 * "did it read my document?" is answered before it is asked. See
 * `lib/chat/context-tray.ts` for why that distinction is the point.
 */

const ORIGIN_ICON: Record<ContextOrigin, typeof FileText> = {
  attachment: FileText,
  project: FolderOpen,
  memory: Brain,
};

const ORIGIN_LABEL: Record<ContextOrigin, string> = {
  attachment: "Attached now",
  project: "From this project",
  memory: "Memory",
};

export function ContextTray({
  entries,
  onRemove,
  className,
}: {
  entries: ContextEntry[];
  onRemove?: (entry: ContextEntry) => void;
  className?: string;
}) {
  const summary = summariseTray(entries);
  // No sources means no tray. An empty box announcing that nothing is attached
  // is noise on the most-used screen in the product.
  if (!summary) return null;

  return (
    <section
      aria-label="What OCADE will read"
      className={cn(
        "rounded-xl border border-border/60 bg-secondary/25 px-3 py-2.5 text-[12px]",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-foreground">OCADE will read</h3>
        <p className="truncate text-[11.5px] text-muted-foreground">{summary}</p>
      </header>

      <ul className="mt-2 flex flex-col gap-1">
        {entries.map((entry) => {
          const Icon = entry.treatment === "unreadable" ? AlertTriangle : ORIGIN_ICON[entry.origin];
          return (
            <li
              key={entry.id}
              className={cn(
                "flex items-start gap-2 rounded-lg border border-border/50 bg-background/50 px-2 py-1.5",
                entry.treatment === "unreadable" && "border-[color:var(--state-warning)]/40",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0",
                  entry.treatment === "unreadable"
                    ? "text-[color:var(--state-warning)]"
                    : "text-muted-foreground",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-foreground">{entry.name}</span>
                  <span className="shrink-0 rounded border border-border/60 px-1 text-[10px] text-muted-foreground">
                    {ORIGIN_LABEL[entry.origin]}
                  </span>
                  {entry.treatment === "searched" ? (
                    <Search className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                  ) : null}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {describeEntry(entry)}
                </p>
              </div>

              {entry.removable && onRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(entry)}
                  aria-label={`Do not use ${entry.name} for this question`}
                  className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
