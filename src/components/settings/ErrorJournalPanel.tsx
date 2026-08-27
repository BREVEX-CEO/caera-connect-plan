import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shell/GlassPanel";
import {
  clearErrorJournal,
  formatErrorJournal,
  JOURNAL_LIMIT,
  readErrorJournal,
  type JournalEntry,
} from "@/lib/diagnostics/error-journal";

/**
 * The errors this browser actually hit.
 *
 * The page above it promised "error triage" and had none: crashes went to two
 * globals that exist only in a development preview, so on the real site they
 * went nowhere. Somebody whose screen went blank yesterday had a sentence and
 * no evidence.
 *
 * Everything here is on this device and stays there. There is no upload
 * control, because there is nothing to upload to — the copy button puts it on
 * the clipboard and the person decides who sees it.
 */
export function ErrorJournalPanel() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(() => setEntries(readErrorJournal()), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(formatErrorJournal(entries));
      toast.success("Copied. Nothing was sent anywhere.");
    } catch {
      // Same rule as everywhere else: a refused clipboard must not look like
      // a successful copy.
      toast.error("This browser would not let the page copy. Select the text instead.");
    }
  }

  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Errors on this device
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The last {JOURNAL_LIMIT} failures this browser hit, kept here and nowhere else.
            Addresses, tokens and keys are removed before anything is written down.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void copyAll()}
            disabled={entries.length === 0}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border/60 px-2.5 text-xs text-foreground transition hover:bg-accent/30 disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
          </button>
          <button
            type="button"
            onClick={() => {
              clearErrorJournal();
              refresh();
            }}
            disabled={entries.length === 0}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border/60 px-2.5 text-xs text-foreground transition hover:bg-accent/30 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border/50 p-4 text-xs text-muted-foreground">
          Nothing has gone wrong on this device since the journal was last cleared.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {entries.map((entry, index) => {
            const key = `${entry.at}-${index}`;
            const open = expanded === key;
            return (
              <li key={key} className="rounded-lg border border-border/50 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">{entry.where}</span>
                  <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
                </div>
                <p className="mt-1 break-words text-[13px] text-foreground">{entry.message}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{entry.route}</p>
                {entry.stack ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : key)}
                      aria-expanded={open}
                      className="mt-2 text-[11px] text-muted-foreground underline"
                    >
                      {open ? "Hide where it happened" : "Show where it happened"}
                    </button>
                    {open ? (
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-background/50 p-2 font-mono text-[11px] text-muted-foreground">
                        {entry.stack}
                      </pre>
                    ) : null}
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
  );
}
