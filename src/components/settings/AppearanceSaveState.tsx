import { AlertTriangle, Check, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { useAppearance } from "@/lib/use-appearance";

/**
 * Where the appearance preferences on this screen were actually saved.
 *
 * Appearance is the one settings area that applies instantly and is therefore
 * the easiest to lie about: the switch moves, the interface changes, and a
 * failed write is invisible until the next refresh silently reverts it. This
 * strip states the truth for each of the three outcomes — saved to the account,
 * saved to this browser only, or not saved at all — and offers a retry rather
 * than leaving the user to flip the switch again and hope.
 */
export function AppearanceSaveState() {
  const { persistence, retryPersist } = useAppearance();
  const { status, scope, message, loadError, loadedFromCloud } = persistence;

  const failed = status === "error" || scope === "none";

  if (failed) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[11.5px] text-foreground"
      >
        <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
        <div className="flex-1">
          <p>{message ?? "We couldn't save your motion and depth preferences."}</p>
          <button
            type="button"
            onClick={() => void retryPersist()}
            className="mt-1.5 inline-flex h-6 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] text-foreground hover:bg-secondary/60"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Try saving again
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-md border border-border/60 bg-secondary/30 px-2.5 py-2 text-[11.5px] text-muted-foreground"
      >
        <CloudOff className="mt-[1px] h-3.5 w-3.5 shrink-0" aria-hidden />
        <div className="flex-1">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void retryPersist()}
            className="mt-1.5 inline-flex h-6 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] text-foreground hover:bg-secondary/60"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Sync these settings to my account
          </button>
        </div>
      </div>
    );
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
    >
      {status === "saving" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Saving…
        </>
      ) : (
        <>
          <Check className="h-3 w-3" aria-hidden />
          {scope === "cloud" || loadedFromCloud
            ? "Motion, depth and appearance are saved to your account, so they come back after a refresh and in new sessions on your other devices."
            : "Motion, depth and appearance are saved on this browser and restored after a refresh. Sign in to carry them to your other devices."}
        </>
      )}
    </p>
  );
}
