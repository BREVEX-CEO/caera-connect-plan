import { useCallback, useEffect, useRef, useState } from "react";
import { detectHardwareFn } from "@/lib/hardware.functions";
import { startLocalRuntimeFn, localRuntimeStatusFn } from "@/lib/local-runtime.functions";
import {
  selectTier,
  consentLine,
  type TierManifest,
  type TierSelection,
} from "@/lib/local/tier-policy";
import { pullModel, type PullProgress } from "@/lib/local/model-lifecycle";
import { DEFAULT_LOCAL_BRIDGE_URL } from "@/lib/ocade-local";
import { discoverLocalModels } from "@/lib/ocade-local";
import manifestJson from "../../../release/OCADE_LOCAL_ENGINE_MODEL_MANIFEST.json";

/**
 * First-run engine setup (W4).
 *
 * Before this, OCADE knew nothing about the machine it was running on. Hardware
 * detection existed as a command-line script the app could not call, the tier
 * manifest resolved in B1 was read by no source module, and there was no
 * first-run flow at all — a new user landed in a chat window with no model and
 * no explanation.
 *
 * WHAT THE USER SEES: one screen, one decision.
 *
 * They never pick a model and never see a model list. OCADE measures the
 * machine, selects the tier from the manifest, and asks a single question —
 * whether to download it — naming the real size in gigabytes.
 *
 * WHY THERE IS A QUESTION AT ALL
 *
 * `skills/hardware-profile.ts` records a deliberate rule: a fitting model is
 * "Offered for approval — never auto-installed." Pulling several gigabytes
 * onto someone's connection unannounced is not a detail, and on a metered
 * connection it is a real cost. So this softens that rule precisely and no
 * further: the CHOICE is automatic, the DOWNLOAD is consented once. After that
 * it never asks again.
 */

const manifest = manifestJson as unknown as TierManifest;

type Phase =
  | "checking"
  | "not-needed"
  | "awaiting-consent"
  | "starting-engine"
  | "downloading"
  | "ready"
  | "failed";

export function FirstRunEngineSetup() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [selection, setSelection] = useState<TierSelection | null>(null);
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  /** Decide whether anything needs doing at all. */
  const assess = useCallback(async () => {
    setPhase("checking");
    setProblem(null);
    try {
      // Already have a model? Then there is nothing to set up and the user
      // should never see this at all.
      const discovery = await discoverLocalModels(DEFAULT_LOCAL_BRIDGE_URL);
      if (discovery.ok && discovery.models.some((m) => !m.isCloudPointer)) {
        setPhase("not-needed");
        return;
      }

      const profile = await detectHardwareFn();
      const chosen = selectTier(profile, manifest);
      if (!chosen.ok) {
        // A machine that cannot run any tier is told which limit stopped it,
        // not shown a spinner forever.
        setProblem(chosen.reason);
        setPhase("failed");
        return;
      }
      setSelection(chosen);
      setPhase("awaiting-consent");
    } catch (error) {
      setProblem(
        `OCADE could not check this device: ${error instanceof Error ? error.message : String(error)}`,
      );
      setPhase("failed");
    }
  }, []);

  useEffect(() => {
    void assess();
  }, [assess]);

  const install = useCallback(async () => {
    if (!selection) return;
    setProblem(null);
    controller.current = new AbortController();

    setPhase("starting-engine");
    const started = await startLocalRuntimeFn();
    if (!started.ok) {
      setProblem(started.reason);
      setPhase("failed");
      return;
    }

    setPhase("downloading");
    const pulled = await pullModel(DEFAULT_LOCAL_BRIDGE_URL, selection.tier.tag, {
      expectedBytes: selection.tier.expectedStorageBytes,
      signal: controller.current.signal,
      onProgress: setProgress,
    });

    if (!pulled.ok) {
      setProblem(
        pulled.failure === "cancelled"
          ? "Download cancelled. Nothing was installed, and you can start it again whenever you like."
          : pulled.reason,
      );
      setPhase(pulled.failure === "cancelled" ? "awaiting-consent" : "failed");
      return;
    }

    // A completed download is not a working engine. Only a model the runtime
    // will actually list counts as ready.
    const status = await localRuntimeStatusFn();
    if (!status.running) {
      setProblem("The download finished but the engine is not responding. Try starting it again.");
      setPhase("failed");
      return;
    }
    setPhase("ready");
  }, [selection]);

  const cancel = useCallback(() => controller.current?.abort(), []);

  // Nothing to show once a model exists, or while the first check runs.
  if (phase === "not-needed" || phase === "checking") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-heading"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 id="first-run-heading" className="text-lg font-semibold">
          Set up OCADE on this device
        </h2>

        {phase === "awaiting-consent" && selection && (
          <>
            <p className="mt-3 text-sm text-muted-foreground">{selection.because}</p>
            <p className="mt-3 text-sm font-medium">{consentLine(selection)}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Your conversations stay on this computer. The engine listens only to this machine and
              is never reachable from your network.
            </p>
            {problem && (
              <p className="mt-3 text-xs text-muted-foreground" role="status">
                {problem}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
                onClick={() => void install()}
              >
                Continue
              </button>
              <button
                type="button"
                className="rounded border border-border px-4 py-2 text-sm"
                onClick={() => setPhase("not-needed")}
              >
                Not now
              </button>
            </div>
          </>
        )}

        {phase === "starting-engine" && (
          <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
            Starting the local engine…
          </p>
        )}

        {phase === "downloading" && (
          <>
            <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
              Downloading —{" "}
              {progress?.percent !== null && progress?.percent !== undefined
                ? `${Math.round(progress.percent)}%`
                : "preparing"}
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress?.percent ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              You can cancel and resume later — finished parts are kept, so it will not start over.
            </p>
            <button
              type="button"
              className="mt-4 rounded border border-border px-3 py-1 text-xs"
              onClick={cancel}
            >
              Cancel
            </button>
          </>
        )}

        {phase === "ready" && (
          <>
            <p className="mt-3 text-sm">OCADE is ready. Everything runs on this device.</p>
            <button
              type="button"
              className="mt-4 rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
              onClick={() => setPhase("not-needed")}
            >
              Start using OCADE
            </button>
          </>
        )}

        {phase === "failed" && (
          <>
            <p className="mt-3 text-sm text-destructive" role="alert">
              {problem}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded border border-border px-3 py-1 text-sm"
                onClick={() => void assess()}
              >
                Try again
              </button>
              <button
                type="button"
                className="rounded border border-border px-3 py-1 text-sm"
                onClick={() => setPhase("not-needed")}
              >
                Continue without it
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
