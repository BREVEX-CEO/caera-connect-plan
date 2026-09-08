import { useState } from "react";
import { HardDrive, ShieldCheck, Trash2 } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { recordAction } from "@/lib/actions";
import {
  deleteLocalData,
  LOCAL_DATA_CLASS_LABELS,
  readModelIdentityFromStore,
  type LocalDataClass,
  type LocalDataDeletionResult,
} from "@/lib/storage/local-data";

type SelectableClass = Exclude<LocalDataClass, "all_account_data">;

/**
 * WHAT THIS BROWSER IS HOLDING, AND HOW TO CLEAR PART OF IT — PLAN.md §A.
 *
 * The account panel above this one is about data OCADE received. This one is
 * about data that never left the machine, and the two are genuinely different
 * requests: somebody clearing a shared laptop wants this, and somebody
 * exercising a data right wants the other.
 *
 * PER SELECTION, NOT ALL OR NOTHING. §A asks for per-selection controls, and
 * the reason is ordinary: a person who wants to clear a search index they think
 * is stale should not have to destroy their drafts to do it.
 *
 * THE RECEIPT SAYS THE MODEL SURVIVED, AND MEANS IT. `deleteLocalData` reads
 * the active model identity before and after and returns both, so this can show
 * a measured fact rather than a reassurance. That guarantee — that clearing
 * account data never removes Offline Intelligence — is the one PLAN.md §A and
 * §O both turn on, and the one people are right not to take on trust.
 */
export function LocalDataPanel() {
  const [selected, setSelected] = useState<Set<SelectableClass>>(new Set());
  const [result, setResult] = useState<LocalDataDeletionResult | null>(null);

  const entries = Object.entries(LOCAL_DATA_CLASS_LABELS) as [
    SelectableClass,
    { label: string; description: string },
  ][];

  function toggle(id: SelectableClass) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clear() {
    const classes = [...selected];
    if (classes.length === 0) return;
    void recordAction({
      actionId: "account.local_data.delete",
      metadata: { classes },
    });
    const outcome = deleteLocalData(classes, {
      readModelIdentity: () => readModelIdentityFromStore(),
    });
    setResult(outcome);
    setSelected(new Set());
  }

  const modelHeld = result !== null && result.modelBefore?.version === result.modelAfter?.version;

  return (
    <GlassPanel className="mt-4 p-5">
      <header className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Data on this device</h3>
      </header>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">
        Kept in this browser and nowhere else. Pick what to clear — nothing here touches your
        account, and nothing here can remove Offline Intelligence.
      </p>

      <fieldset className="mt-4">
        <legend className="sr-only">Kinds of data held on this device</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {entries.map(([id, entry]) => (
            <li key={id}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border/60 p-3 text-xs hover:bg-accent/20">
                <input
                  type="checkbox"
                  checked={selected.has(id)}
                  onChange={() => toggle(id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--primary)]"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{entry.label}</span>
                  <span className="mt-0.5 block leading-5 text-muted-foreground">
                    {entry.description}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="destructive"
          size="sm"
          className="gap-2"
          disabled={selected.size === 0}
          onClick={clear}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Clear {selected.size === 0 ? "selected" : `${selected.size} selected`}
        </Button>
        {selected.size > 0 ? (
          <span className="text-xs text-muted-foreground">
            This browser only. It cannot be undone.
          </span>
        ) : null}
      </div>

      {result ? (
        <div
          role="status"
          className="mt-4 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs leading-6 text-muted-foreground"
        >
          <p>
            <strong className="text-foreground">
              {result.deletedRecords} record{result.deletedRecords === 1 ? "" : "s"} cleared
            </strong>{" "}
            from {result.deletedClasses.length} kind
            {result.deletedClasses.length === 1 ? "" : "s"} on this device.
          </p>
          <p className="mt-1 flex items-start gap-1.5">
            <ShieldCheck
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--state-success)]"
              aria-hidden
            />
            {result.modelBefore === null
              ? "No Offline Intelligence is installed on this device, so there was nothing for this to affect."
              : modelHeld
                ? `Offline Intelligence ${result.modelBefore.version} is still installed and still verified. Clearing local data made no request to a model source.`
                : "Offline Intelligence changed during this clear. Please report this — it should not be possible."}
          </p>
        </div>
      ) : null}
    </GlassPanel>
  );
}
