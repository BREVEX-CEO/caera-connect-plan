import { useInstallation } from "@/lib/brain/use-installation";
import { cn } from "@/lib/utils";

/**
 * The preparation line beside a composer, in the demo and in signed-in Chat.
 *
 * IT READS THE AUTHORITY, NOT A STORE OF ITS OWN. This used to subscribe to
 * `lib/brain/preparation.ts`, which the adapters published into — while the
 * chat engine kept a completely separate `EngineState.status`. Nothing
 * reconciled the two, which is how "Local engine unavailable" came to be
 * rendered directly above "Preparing OCADE — 62%": both were true of their own
 * store and neither knew about the other. There is one state now, so that is no
 * longer a thing that can be rendered.
 *
 * IT STARTS NOTHING. Reading is safe from any number of surfaces; preparation
 * begins once, at the application root. A progress line that could kick off a
 * download would be another one of the five independent installers this whole
 * change removed.
 *
 * The full-screen version is `SetupExperience`. This is the quiet one, for the
 * surfaces where OCADE is only PART of what is on the screen.
 */
export function PreparationStatus({ className }: { className?: string }) {
  const { state, line, preparing } = useInstallation();

  // Nothing to say before anything starts, and nothing to say once it is done.
  // A permanent "ready" chip beside a composer is furniture, not information.
  if (!preparing && state.stage !== "paused") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="ocade-preparation-status"
      data-stage={state.stage}
      className={cn(
        "mb-2 rounded-xl border border-border/60 bg-secondary/35 px-3 py-2 text-[12px] text-muted-foreground",
        className,
      )}
    >
      <span className="block text-foreground">{line}</span>
      {state.observing ? (
        <span className="mt-0.5 block text-[11px]">
          Being prepared in another OCADE window.
        </span>
      ) : null}
      {state.fraction !== null ? (
        <progress
          aria-label="Preparing OCADE"
          className="mt-1.5 h-1.5 w-full accent-[color:var(--accent-ocade)]"
          max={1}
          value={Math.max(0, Math.min(1, state.fraction))}
        />
      ) : null}
    </div>
  );
}
