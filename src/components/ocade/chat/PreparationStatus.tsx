import { useSyncExternalStore } from "react";
import {
  describePreparation,
  preparationState,
  subscribeToPreparation,
} from "@/lib/brain/preparation";
import { cn } from "@/lib/utils";

/**
 * Visible first-run model preparation shared by demo and signed-in Chat.
 *
 * The adapters have always reported real download/load progress. Keeping this
 * subscriber beside the composer makes that report reachable at the moment a
 * person is waiting, without exposing model filenames or runtime jargon.
 */
export function PreparationStatus({ className }: { className?: string }) {
  const state = useSyncExternalStore(subscribeToPreparation, preparationState, preparationState);

  if (state.stage === "idle" || state.stage === "ready") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "mb-2 rounded-xl border border-border/60 bg-secondary/35 px-3 py-2 text-[12px] text-muted-foreground",
        className,
      )}
    >
      <span className="block text-foreground">{describePreparation(state)}</span>
      {state.fraction !== null ? (
        <progress
          aria-label="Preparing OCADE Intelligence"
          className="mt-1.5 h-1.5 w-full accent-[color:var(--accent-ocade)]"
          max={1}
          value={Math.max(0, Math.min(1, state.fraction))}
        />
      ) : null}
    </div>
  );
}
