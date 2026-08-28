import { useEffect, useMemo, useRef, useState } from "react";
import { useInstallation } from "@/lib/brain/use-installation";
import { isErrorStage } from "@/lib/brain/installation-state";
import type { InstallRemedy } from "@/lib/brain/installation-authority";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The screen a visitor sees while OCADE prepares their device.
 *
 * WHAT IT IS FOR. Setting up a local engine takes real time on a real
 * connection, and there is no way to make that instant. What there is a way to
 * make it is INTENTIONAL: a person who understands that something deliberate is
 * happening, and roughly how long is left, waits happily; a person watching an
 * unexplained bar move waits badly and leaves. The whole design is aimed at the
 * difference between those two.
 *
 * THREE RULES IT KEEPS
 *
 * 1. **It never names the machinery.** No model, no vendor, no file, no
 *    quantisation, no size in megabytes, no "WebGPU", no "WebAssembly". Those
 *    belong in diagnostics. A first-time visitor is not debugging a runtime,
 *    and telling them whose model this is says something about OCADE that OCADE
 *    does not want to say.
 *
 * 2. **It never invents a number.** The percentage is measured. The time
 *    remaining appears only once throughput has actually been sampled, which is
 *    why the first seconds show no estimate rather than the "about 3 hours"
 *    that every download shows for a moment and that teaches people the number
 *    is fiction.
 *
 * 3. **It offers only actions that are safe right now.** Nothing here can start
 *    a second install, and there is deliberately no composer, no send, no new
 *    chat and no demo navigation while setup runs — see `SetupLock` below.
 *
 * AND THE PROMISE ABOUT THE CLOCK. "Your 28-minute demo begins when setup is
 * complete" is shown because it is TRUE: no session exists yet, no deadline has
 * been created, and nothing is counting. `use-demo-session` will not create one
 * until the engine has proven itself ready.
 */

/** The stages, as a person experiences them rather than as the machine does. */
const NARRATIVE: { match: (stage: string) => boolean; line: string }[] = [
  {
    match: (s) => s === "checking_device" || s === "checking_storage",
    line: "Preparing this device",
  },
  { match: (s) => s === "preparing_runtime" || s === "waiting_for_source", line: "Starting OCADE" },
  { match: (s) => s === "downloading" || s === "retrying", line: "Preparing OCADE" },
  { match: (s) => s === "verifying", line: "Securing local intelligence" },
  { match: (s) => s === "loading", line: "Optimising for this device" },
  { match: (s) => s === "warming", line: "Almost ready" },
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

export interface SetupExperienceProps {
  /** Shown under the headline. One sentence, product language only. */
  promise?: string;
  /** Called once the engine is genuinely ready. */
  onReady?: () => void;
  /** Rendered as a quiet escape. Setup continues in the background. */
  onLeave?: () => void;
  leaveLabel?: string;
  className?: string;
}

export function SetupExperience({
  promise = "Your 28-minute demo begins when setup is complete.",
  onReady,
  onLeave,
  leaveLabel = "Back",
  className,
}: SetupExperienceProps) {
  const { state, preparing, ready, retry, reinstall, uninstall, remedies } = useInstallation();
  const [removing, setRemoving] = useState(false);
  const [showStorageHelp, setShowStorageHelp] = useState(false);

  /*
   * FIRED ONCE, and a ref rather than state.
   *
   * `onReady` navigates and creates the demo session. Both are unsafe to run
   * twice, and a subscription can deliver several updates in a burst when a tab
   * is refocused — state would not have settled before the second arrived.
   */
  const announced = useRef(false);
  useEffect(() => {
    if (ready && !announced.current) {
      announced.current = true;
      onReady?.();
    }
  }, [ready, onReady]);

  /*
   * NOTHING IS RUNNING AND THE USER IS LOOKING AT A SETUP SCREEN: START.
   *
   * `idle` reaches this screen in one real situation — the person removed OCADE
   * Intelligence, which suppresses the AUTOMATIC preparation on later visits so
   * that the removal means something. Navigating to the demo is not automatic;
   * it is somebody asking for OCADE. Honouring that is the difference between a
   * respected choice and a screen that sits still forever.
   *
   * `reinstall` rather than `retry`: it clears the removal, which is exactly
   * what the request implies.
   */
  const asked = useRef(false);
  useEffect(() => {
    if (state.stage === "idle" && !asked.current) {
      asked.current = true;
      reinstall();
    }
  }, [state.stage, reinstall]);

  const headline = narrativeFor(state.stage);
  const percent = state.fraction === null ? null : Math.round(state.fraction * 100);
  const eta = formatEta(state.etaSeconds);
  const failed = isErrorStage(state.stage);

  /*
   * The ring is driven by the measured fraction where there is one, and by a
   * slow indeterminate sweep where there is not. It never shows a made-up
   * position: an unknown fraction looks like motion, not like 40%.
   */
  const circumference = 2 * Math.PI * 54;
  const dash = useMemo(
    () =>
      state.fraction === null ? null : circumference * Math.min(1, Math.max(0, state.fraction)),
    [state.fraction, circumference],
  );

  return (
    <div
      className={cn(
        "relative flex min-h-[70vh] w-full flex-col items-center justify-center overflow-hidden px-6 py-16 text-center",
        className,
      )}
      data-testid="ocade-setup-experience"
      data-stage={state.stage}
    >
      {/* One soft light source behind the mark, not a page-wide gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--accent-ocade)]/10 blur-[130px]"
      />

      <div className="relative flex flex-col items-center">
        <SetupOrb
          active={preparing}
          settled={ready}
          failed={failed}
          dash={dash}
          circumference={circumference}
        />

        {/*
          ONE live region for the whole screen. The headline and the percentage
          are the same fact, so announcing them separately would read the stage
          twice to a screen-reader user on every update.
        */}
        <div role="status" aria-live="polite" className="mt-10 max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {failed ? "OCADE needs a hand" : headline}
            {preparing && !failed ? <AnimatedEllipsis /> : null}
          </h1>

          {failed ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{state.problem}</p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {state.observing
                ? "OCADE is already preparing this device in another window. This one will be ready at the same time."
                : promise}
            </p>
          )}

          {percent !== null && preparing && !failed ? (
            <p className="mt-4 text-[13px] tabular-nums text-foreground/80">
              {percent}%{eta ? <span className="text-muted-foreground"> · {eta}</span> : null}
            </p>
          ) : null}
        </div>

        {/*
          THE ONLY ACTIONS AVAILABLE, and every one of them is safe.

          Nothing here can begin a second install: Try again joins the one
          authority, and Remove is a deliberate uninstall the person asked for.
          There is no composer, no send, and no way into the demo, because a
          screen that let somebody type into a chat with no engine behind it
          would be offering something it cannot do.
        */}
        <div className="relative mt-9 flex flex-wrap items-center justify-center gap-2">
          {failed
            ? remedies.map((remedy) => (
                <SetupRemedyButton
                  key={remedy}
                  remedy={remedy}
                  busy={removing}
                  onRetry={retry}
                  onFreeStorage={() => setShowStorageHelp((open) => !open)}
                  onRemove={async () => {
                    setRemoving(true);
                    try {
                      await uninstall();
                    } finally {
                      setRemoving(false);
                    }
                  }}
                />
              ))
            : null}

          {onLeave ? (
            <Button variant="ghost" size="sm" onClick={onLeave} className="text-muted-foreground">
              {leaveLabel}
            </Button>
          ) : null}
        </div>

        {showStorageHelp ? <StorageHelp /> : null}
      </div>
    </div>
  );
}

/**
 * The mark at the centre: a progress ring around a slowly breathing core.
 *
 * Everything animated here is `transform` and `opacity` — the two properties a
 * browser can composite without touching layout or paint. That is not a
 * detail on the devices this screen matters most on: the whole point is that
 * the animation stays smooth on a mid-range phone while several connections,
 * a hashing loop and continuous disk writes are all running.
 *
 * And it honours `prefers-reduced-motion`: the ring still fills, because that
 * is information, but the drifting and pulsing stop.
 */
function SetupOrb({
  active,
  settled,
  failed,
  dash,
  circumference,
}: {
  active: boolean;
  settled: boolean;
  failed: boolean;
  dash: number | null;
  circumference: number;
}) {
  return (
    <div className="relative h-[136px] w-[136px]">
      <svg
        aria-hidden
        viewBox="0 0 136 136"
        className={cn(
          "absolute inset-0 h-full w-full -rotate-90",
          active && dash === null ? "ocade-setup-sweep" : null,
        )}
      >
        <circle cx="68" cy="68" r="54" fill="none" strokeWidth="2" className="stroke-border/60" />
        <circle
          cx="68"
          cy="68"
          r="54"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={cn(
            "transition-[stroke-dasharray] duration-500 ease-out",
            failed ? "stroke-destructive/70" : "stroke-[color:var(--accent-ocade)]",
          )}
          strokeDasharray={
            dash === null
              ? // Indeterminate: a short arc that sweeps. It is visibly not a
                // position, so nobody reads it as one.
                `${circumference * 0.18} ${circumference}`
              : `${dash} ${circumference}`
          }
        />
      </svg>

      <div
        aria-hidden
        className={cn(
          "absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full",
          "bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklch,var(--accent-ocade)_85%,white),color-mix(in_oklch,var(--accent-ocade)_45%,black))]",
          "shadow-[0_0_50px_color-mix(in_oklch,var(--accent-ocade)_45%,transparent)]",
          active ? "ocade-setup-breathe" : null,
          settled ? "scale-105 transition-transform duration-700" : null,
          failed ? "opacity-60 saturate-50" : null,
        )}
      />

      <style>{`
        @keyframes ocade-setup-breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.92; }
          50%      { transform: translate(-50%, -50%) scale(1.07); opacity: 1; }
        }
        @keyframes ocade-setup-sweep {
          to { transform: rotate(360deg); }
        }
        .ocade-setup-breathe { animation: ocade-setup-breathe 3.4s ease-in-out infinite; }
        .ocade-setup-sweep {
          transform-origin: 50% 50%;
          animation: ocade-setup-sweep 2.4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ocade-setup-breathe, .ocade-setup-sweep { animation: none; }
        }
      `}</style>
    </div>
  );
}

/** Three dots that move without re-rendering the sentence around them. */
function AnimatedEllipsis() {
  return (
    <span aria-hidden className="ocade-setup-dots">
      <span>.</span>
      <span>.</span>
      <span>.</span>
      <style>{`
        @keyframes ocade-setup-dot { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }
        .ocade-setup-dots span { animation: ocade-setup-dot 1.4s infinite; }
        .ocade-setup-dots span:nth-child(2) { animation-delay: 0.2s; }
        .ocade-setup-dots span:nth-child(3) { animation-delay: 0.4s; }
        @media (prefers-reduced-motion: reduce) {
          .ocade-setup-dots span { animation: none; opacity: 0.6; }
        }
      `}</style>
    </span>
  );
}

function SetupRemedyButton({
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
    case "use_another_device":
      return (
        <p className="w-full text-xs text-muted-foreground">
          You can also open OCADE on another device — your account and your work move with you.
        </p>
      );
    case "pair_a_device":
      return (
        <a
          href="/download"
          className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
        >
          {label}
        </a>
      );
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
    <div className="mt-6 max-w-md rounded-xl border border-border/60 bg-secondary/30 p-4 text-left text-[13px] leading-6 text-muted-foreground">
      <p className="font-medium text-foreground">Making room</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
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

/**
 * Everything that must not be usable while setup is running.
 *
 * Wrap a surface in this and it becomes inert and visibly so: no typing, no
 * sending, no navigation into a room that needs an engine. It exists because
 * the alternative — leaving the composer live and failing on send — is a
 * product that invites an action it cannot honour.
 *
 * `inert` where the browser has it, with `pointer-events` and `aria-hidden` as
 * the fallback, so keyboard users are excluded from the disabled region too
 * rather than being the only people who can still reach it.
 */
export function SetupLock({ locked, children }: { locked: boolean; children: React.ReactNode }) {
  return (
    <div
      // React 19 passes `inert` through as a real attribute.
      inert={locked ? true : undefined}
      aria-hidden={locked ? true : undefined}
      className={cn(locked ? "pointer-events-none select-none opacity-40" : null)}
    >
      {children}
    </div>
  );
}
