import { useState } from "react";
import { useInstallation } from "@/lib/brain/use-installation";
import { offlineRelease } from "@/lib/brain/offline-release";
import { readSetupAcceptance, REMOVED_DETAIL } from "@/lib/brain/installation-state";
import { useOnline } from "@/lib/use-online";

/**
 * OFFLINE MODE SETUP, IN THE PERSON'S WORDS.
 *
 * One place that says where Offline Mode stands and offers the one next step:
 * Set up, Pause, Try again. Used by the gated Offline Chat view and by
 * Settings, so the two cannot describe the same state differently.
 *
 * WHAT IT NEVER SAYS: the word "download", a model or file name, a size, or a
 * storage figure (plan 14B.2). The progress bar moves only while real setup
 * work runs; without a network before the first setup it shows a plain
 * pending sentence instead of a false animation, and offers setup again the
 * moment the network returns.
 */
export function OfflineModeSetup({ signedIn }: { signedIn: boolean }) {
  const install = useInstallation();
  const online = useOnline();
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  if (!offlineRelease()) {
    return <Line>Offline Mode is not available in this version of OCADE yet.</Line>;
  }
  if (install.ready) return <Line>Offline Chat is ready</Line>;

  const stage = install.state.stage;
  const working = install.preparing;
  const stopped =
    stage === "paused" || stage === "recoverable_error" || stage === "insufficient_storage";

  if (!online && !working) {
    return <Line>Connect to the internet once to set up Offline Mode.</Line>;
  }
  if (!signedIn) return <Line>Sign in to set up Offline Mode.</Line>;

  const start = async () => {
    setAsking(true);
    setProblem(null);
    const allowed = await install.setUp().catch(() => false);
    setAsking(false);
    if (!allowed) {
      setProblem(
        "Every offline place on your account is in use. Remove a device under Usage & Limits, then try again.",
      );
    }
  };

  // Accepted here before: the next check or repair is on its way, not a new offer.
  if (stage === "idle" && readSetupAcceptance() !== null) {
    return <Line>Checking Offline Mode</Line>;
  }

  const fraction = install.state.fraction;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-foreground" role="status" aria-live="polite">
        {problem ??
          (working || stopped || stage === "fatal_error"
            ? install.line
            : "Use Chat with no connection.")}
      </p>
      {working ? (
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-label="Preparing Offline Mode"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={fraction === null ? undefined : Math.round(fraction * 100)}
        >
          {fraction === null ? (
            <div className="h-full w-1/3 rounded-full bg-primary motion-safe:animate-[ocade-indeterminate_1.4s_ease-in-out_infinite]" />
          ) : (
            <div
              className="h-full bg-primary motion-safe:transition-[width]"
              style={{ width: `${Math.round(fraction * 100)}%` }}
            />
          )}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {working ? (
          <Button onClick={install.pause}>Pause</Button>
        ) : stage === "fatal_error" ? null : stopped ? (
          <Button onClick={start} busy={asking}>
            Try again
          </Button>
        ) : (
          <Button onClick={start} busy={asking} primary>
            Set up Offline Mode
          </Button>
        )}
      </div>
    </div>
  );
}

function Line({ children }: { children: string }) {
  return (
    <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
      {children}
    </p>
  );
}

function Button({
  children,
  onClick,
  busy,
  primary,
}: {
  children: string;
  onClick: () => void | Promise<void>;
  busy?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onClick()}
      className={
        primary
          ? "h-8 rounded-md bg-primary px-3 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          : "h-8 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

const OFFER_DISMISSED_KEY = "ocade.offline-mode.offer-dismissed.v1";

function offerDismissed(): boolean {
  try {
    return window.localStorage.getItem(OFFER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * THE UNOBTRUSIVE OFFER. Shown in Chat while online when this browser has not
 * set up Offline Mode and nobody declined it here. Accepting starts setup over
 * whatever connection is available, with no further question; "Not now" hides
 * the offer for this browser and starts nothing. Settings and the Offline
 * choice keep the explicit entry points either way.
 */
export function OfflineModeOffer() {
  const install = useInstallation();
  const online = useOnline();
  const [hidden, setHidden] = useState(offerDismissed);
  const [problem, setProblem] = useState<string | null>(null);

  const notSetUp =
    install.state.stage === "idle" &&
    install.state.detail !== REMOVED_DETAIL &&
    readSetupAcceptance() === null;
  if (hidden || !online || !notSetUp || !offlineRelease()) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
      <span role="status">{problem ?? "Chat with no connection, on this device."}</span>
      <button
        type="button"
        onClick={() =>
          void install.setUp().then((allowed) => {
            if (!allowed) {
              setProblem("Every offline place on your account is in use.");
            }
          })
        }
        className="text-foreground underline underline-offset-2"
      >
        Set up Offline Mode
      </button>
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(OFFER_DISMISSED_KEY, "1");
          } catch {
            /* The offer hides for this visit either way. */
          }
          setHidden(true);
        }}
        className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Not now
      </button>
    </div>
  );
}
