import { useState } from "react";
import { useInstallation } from "@/lib/brain/use-installation";
import { isErrorStage } from "@/lib/brain/installation-state";
import type { InstallRemedy } from "@/lib/brain/installation-authority";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * PREPARATION IS SOMETHING OCADE IS DOING, NOT SOMETHING THE PERSON IS WAITING
 * FOR.
 *
 * This replaces a full-screen modal. The previous design mounted a
 * `role="dialog" aria-modal="true"` layer over the entire signed-in
 * application for the duration of the first install, and left it there when
 * the install FAILED. The result was reproducible in a browser: a new account
 * signed in, landed on `/onboarding`, filled the form, and could not press
 * Continue — the button was visible and enabled, and the modal above it
 * swallowed every click. There was no way forward and no way out.
 *
 * `PLAN.md` §17 asks for the opposite of that, in as many words: preparation
 * begins automatically, shows LOWER-LEFT PROGRESS, and there is "no
 * confirmation screen or Prepare button". A modal that owns the viewport is a
 * confirmation screen whatever the label on it says.
 *
 * So this is a small panel in the lower-left corner. It reports the same
 * measured state the modal did — the same narrative lines, the same remedies
 * when something goes wrong — and it never takes the product away. Somebody
 * whose device is full can still read their conversations, change their
 * settings, and finish signing up, which are all things they could do before
 * OCADE ever offered to prepare anything.
 *
 * IT STARTS NOTHING. Preparation begins once, at the application root.
 * Reading is safe from any number of surfaces; a progress panel that could
 * kick off a download would be a second installer.
 *
 * IT NEVER INVENTS A NUMBER. The percentage is measured, and the estimate
 * appears only once throughput has actually been sampled — which is why the
 * first seconds show no estimate rather than the "about 3 hours" that every
 * download shows for a moment and that teaches people the number is fiction.
 */

/** The stages, as a person experiences them rather than as the machine does. */
const NARRATIVE: { match: (stage: string) => boolean; line: string }[] = [
  {
    match: (s) => s === "checking_device" || s === "checking_storage",
    line: "Preparing this device",
  },
  { match: (s) => s === "preparing_runtime" || s === "waiting_for_source", line: "Starting OCADE" },
  { match: (s) => s === "downloading" || s === "retrying", line: "Preparing offline intelligence" },
  { match: (s) => s === "verifying" || s === "loading" || s === "warming", line: "Almost ready" },
  { match: (s) => s === "ready", line: "OCADE is ready" },
  { match: (s) => s === "repairing", line: "Checking this device" },
];

function narrativeFor(stage: string): string {
  return NARRATIVE.find((entry) => entry.match(stage))?.line ?? "Starting OCADE";
}

/** "about 2 minutes left", and nothing at all when it has not been measured. */
function formatEta(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 45) return "less than a minute left";
  const minutes = Math.round(seconds / 60);
  if (minutes <= 1) return "about a minute left";
  if (minutes < 60) return `about ${minutes} minutes left`;
  const hours = Math.round(minutes / 60);
  return `about ${hours} hour${hours === 1 ? "" : "s"} left`;
}

const REMEDY_LABELS: Record<InstallRemedy, string> = {
  retry: "Try again",
  free_storage: "How to free up space",
  remove_local_intelligence: "Remove OCADE Intelligence",
  use_another_device: "Use another device",
  pair_a_device: "Pair a computer",
  continue_without: "Continue without setup",
};

export function OfflineIntelligenceProgress({ className }: { className?: string }) {
  const { state, preparing, ready, retry, uninstall, remedies } = useInstallation();
  const [removing, setRemoving] = useState(false);
  const [showStorageHelp, setShowStorageHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const failed = isErrorStage(state.stage);

  /*
   * Nothing to say before anything starts, and nothing to say once it is done.
   * A permanent "ready" chip in the corner is furniture, not information.
   */
  if (ready || dismissed) return null;
  if (!preparing && !failed && state.stage !== "paused") return null;

  const eta = formatEta(state.etaSeconds ?? null);
  const percent = state.fraction === null ? null : Math.round(state.fraction * 100);

  return (
    <div
      /*
       * `role="status"`, NOT `role="dialog"`. It reports; it does not demand.
       * The distinction is the whole point of this component and it is also
       * what a screen reader needs: a polite live region announces the change
       * without moving focus away from whatever the person is actually doing.
       */
      role="status"
      aria-live="polite"
      data-testid="offline-intelligence-progress"
      data-stage={state.stage}
      className={cn(
        /*
         * `pointer-events-none`, WITH `pointer-events-auto` ON EVERY CONTROL.
         *
         * This shipped at `bottom-4 left-4` — the same corner as the sidebar
         * footer, at the same `z-40` as the sidebar itself — and being rendered
         * later it painted on top. The Account menu underneath it was
         * unclickable for the entire time preparation was running, and
         * PERMANENTLY on a device that failed with `insufficient_storage`,
         * because that state does not clear on its own. `audit:journey` caught
         * it: every attempt to sign out timed out with this panel named as the
         * element intercepting the click.
         *
         * A `role="status"` region reports; it does not demand. So it stops
         * absorbing clicks meant for anything else, and its own buttons opt
         * back in individually — the same shape `UnsyncedTurnsBridge` already
         * uses, extended to a panel that has controls of its own.
         */
        "pointer-events-none",
        /*
         * Raised clear of what lives in that corner: the sidebar's account
         * button on a desktop, and `OcadeMobileBottomNav` on a phone. The
         * pass-through above means an overlap can no longer eat a click, but a
         * readout that visually hides the way out of the account is still
         * wrong, and a person cannot click what they cannot see.
         */
        "fixed bottom-20 left-4 z-40 w-[min(20rem,calc(100vw-2rem))]",
        "rounded-xl border border-border/60 bg-background/95 p-3 text-[12px] shadow-lg backdrop-blur",
        "supports-[backdrop-filter]:bg-background/80",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-foreground">
          {failed ? "Offline intelligence is not ready" : narrativeFor(state.stage)}
        </p>
        {/*
          A REAL TOUCH TARGET, not a glyph.

          This shipped as a bare "×" with horizontal padding and measured
          20x18, which the route audit failed on every signed-in route at phone
          width — correctly: a 20px control on a phone is a control most people
          miss and some cannot hit at all. The negative margins keep the
          optical alignment with the heading while the hit area grows to 28px
          square, so the panel looks the same and can actually be dismissed.
        */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Hide preparation status"
          className="pointer-events-auto -mr-1.5 -mt-1.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden>×</span>
        </button>
      </div>

      {state.detail ? <p className="mt-1 text-muted-foreground">{state.detail}</p> : null}

      {state.observing ? (
        <p className="mt-1 text-muted-foreground">Being prepared in another OCADE window.</p>
      ) : null}

      {percent !== null && !failed ? (
        <div className="mt-2">
          {/*
            A real progress element, not a styled div: assistive technology can
            read a value from it, and the value is measured rather than
            animated.
          */}
          <progress
            className="h-1 w-full"
            value={percent}
            max={100}
            aria-label="Offline intelligence preparation"
          />
          <p className="mt-1 tabular-nums text-muted-foreground">
            {percent}%{eta ? ` · ${eta}` : ""}
          </p>
        </div>
      ) : null}

      {failed && remedies.length > 0 ? (
        <div className="pointer-events-auto mt-2 flex flex-wrap gap-1.5">
          {remedies.map((remedy) => (
            <RemedyControl
              key={remedy}
              remedy={remedy}
              busy={removing}
              onRetry={() => void retry()}
              onFreeStorage={() => setShowStorageHelp((open) => !open)}
              onRemove={() => {
                setRemoving(true);
                void uninstall().finally(() => setRemoving(false));
              }}
            />
          ))}
        </div>
      ) : null}

      {showStorageHelp ? <StorageHelp /> : null}
    </div>
  );
}

function RemedyControl({
  remedy,
  busy,
  onRetry,
  onFreeStorage,
  onRemove,
}: {
  remedy: InstallRemedy;
  busy: boolean;
  onRetry: () => void;
  onFreeStorage: () => void;
  onRemove: () => void;
}) {
  const label = REMEDY_LABELS[remedy];
  switch (remedy) {
    case "retry":
      return (
        <Button size="sm" onClick={onRetry}>
          {label}
        </Button>
      );
    case "free_storage":
      return (
        <Button size="sm" variant="outline" onClick={onFreeStorage}>
          {label}
        </Button>
      );
    case "remove_local_intelligence":
      return (
        <Button size="sm" variant="outline" onClick={onRemove} disabled={busy}>
          {busy ? "Removing…" : label}
        </Button>
      );
    case "pair_a_device":
      return (
        <a
          href="/download"
          className="inline-flex items-center justify-center rounded-md border border-border px-2.5 py-1 text-[12px] text-foreground hover:bg-accent"
        >
          {label}
        </a>
      );
    case "use_another_device":
      return (
        <p className="w-full text-muted-foreground">
          You can also open OCADE on another device — your account and your work move with you.
        </p>
      );
    /*
     * `continue_without` has no control any more, and its absence is the fix.
     * It existed to escape a screen that had taken the product away; nothing
     * takes the product away now, so there is nothing to continue past.
     */
    default:
      return null;
  }
}

/**
 * What a person can actually do about a full device.
 *
 * IT DOES NOT CLAIM POWERS OCADE DOES NOT HAVE. A web page cannot clear another
 * site's storage, cannot see the device's free disk, and cannot open the
 * browser's own settings. So it says where those controls are and offers the
 * one thing OCADE genuinely can do — remove what OCADE itself put there.
 */
function StorageHelp() {
  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-secondary/30 p-2.5 leading-5 text-muted-foreground">
      <p className="font-medium text-foreground">Making room</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        <li>Remove OCADE Intelligence above — that frees everything OCADE stored here.</li>
        <li>
          Clear other sites&apos; data from your browser&apos;s own settings. OCADE cannot reach
          another site&apos;s storage, so this one is yours to do.
        </li>
        <li>Delete files or apps you no longer need, then try again.</li>
        <li>Or open OCADE on a device with more room; nothing is lost either way.</li>
      </ul>
    </div>
  );
}
