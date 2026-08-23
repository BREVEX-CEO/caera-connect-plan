import { useCallback, useEffect, useRef, useState } from "react";
import { installLocalRuntimeFn, startLocalRuntimeFn } from "@/lib/local-runtime.functions";
import { FIXED_MODEL } from "@/lib/local/fixed-model";
import { pullModel, type PullProgress } from "@/lib/local/model-lifecycle";
import { activateModel } from "@/lib/local/model-lifecycle";
import { discoverLocalModels, streamLocalChat, DEFAULT_LOCAL_BRIDGE_URL } from "@/lib/ocade-local";
import { serverIsThisMachine } from "@/lib/hardware/detect.browser";
import { useDevicePolicy } from "@/lib/use-device-policy";
import { useBrain } from "@/lib/brain/use-brain";
import {
  subscribeToPreparation,
  describePreparation,
  type PreparationState,
} from "@/lib/brain/preparation";

/**
 * First-run engine setup — silent, automatic, and out of the way.
 *
 * WHAT THIS REPLACED, AND WHY
 *
 * This used to be a full-screen modal that blocked the entire application
 * before the user had done anything, asked them to approve a 4.87 GB download,
 * and — when the runtime was missing — presented a dead end reading "The OCADE
 * Local Engine runtime is not installed in any known location on this machine."
 * Two of those three states were also WRONG whenever OCADE was hosted rather
 * than run locally, because the figures behind them came from the server, not
 * the device. A person on a laptop was told their machine had 251.69 GB of
 * memory.
 *
 * It now does its work in the background and shows a small status pill. OCADE
 * decides which engine suits the device and fetches it without interrupting
 * anyone.
 *
 * WHERE CONTROL LIVES. This surface informs; it does not control. Pause,
 * resume, cancel, repair and remove all live in Settings › Local Engine, on the
 * panel built for them. A transfer nobody can stop would be indefensible; a
 * modal in front of someone who just wants to type is its own problem. So the
 * controls exist, one click away, rather than in the doorway.
 *
 * WHEN IT RENDERS NOTHING AT ALL:
 *  - a usable model is already installed;
 *  - no local runtime is reachable AND the server is not this machine, so there
 *    is nothing on the user's device to manage and cloud already serves them;
 *  - setup failed, in which case Settings explains it rather than a popup.
 */

/**
 * Remembered per browser so a SUCCESSFUL setup does not repeat on every
 * navigation.
 *
 * THIS USED TO BE WRITTEN ON FAILURE TOO, WHICH MADE ONE BAD DOWNLOAD FINAL.
 * A dropped connection, a full disk, a runtime that had not finished starting
 * -- any of them set the flag, and `alreadyAttempted()` then short-circuited
 * forever. The user was left with a product that never tried again and gave no
 * reason. The comment here claimed the Local Engine settings page cleared it;
 * it did not, and nothing else in the codebase ever referenced this key.
 *
 * Now only success is remembered. Failure is counted instead, so setup retries
 * on the next visit but backs off rather than hammering a machine that is
 * genuinely unable.
 */
export const ENGINE_AUTOSETUP_KEY = "ocade.engine.autosetup.v1";

/** How many failed attempts have been made, so retries can back off. */
export const ENGINE_AUTOSETUP_FAILURES = "ocade.engine.autosetup.failures.v1";

/**
 * Stop retrying automatically after this many failures.
 *
 * Not one -- a transient network drop deserves another go. Not unlimited -- a
 * machine with no disk space will fail identically every time, and a download
 * that restarts on every navigation is worse than one that stops and says so.
 */
const MAX_AUTO_ATTEMPTS = 3;

function failureCount(): number {
  try {
    return Number(window.localStorage.getItem(ENGINE_AUTOSETUP_FAILURES) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function recordFailure(): void {
  try {
    window.localStorage.setItem(ENGINE_AUTOSETUP_FAILURES, String(failureCount() + 1));
  } catch {
    /* Storage refused. The next visit simply tries again, which is fine. */
  }
}

function clearFailures(): void {
  try {
    window.localStorage.removeItem(ENGINE_AUTOSETUP_FAILURES);
  } catch {
    /* Nothing to clean up if storage is unavailable. */
  }
}

type Phase = "idle" | "checking" | "starting" | "downloading" | "done" | "unavailable";

function alreadyAttempted(): boolean {
  try {
    return window.localStorage.getItem(ENGINE_AUTOSETUP_KEY) === "done";
  } catch {
    return false;
  }
}

function markAttempted() {
  try {
    window.localStorage.setItem(ENGINE_AUTOSETUP_KEY, "done");
  } catch {
    /* A browser refusing storage simply retries next time. Harmless. */
  }
}

export function FirstRunEngineSetup() {
  const device = useDevicePolicy();
  const brain = useBrain();
  const [preparation, setPreparation] = useState<PreparationState | null>(null);
  useEffect(() => subscribeToPreparation(setPreparation), []);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<PullProgress | null>(null);
  // Which engine is being installed. There is only ever one, so this is a
  // presence flag rather than a choice — see `local/fixed-model.ts`.
  const [selection, setSelection] = useState<typeof FIXED_MODEL | null>(null);
  const started = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    setPhase("checking");

    /*
     * 0. THE BROWSER IS THE ENGINE, SO THE BROWSER IS PREPARED FIRST.
     *
     * This whole component used to begin at step 1 below: ask Ollama on
     * localhost:11434 what it has, and if nothing is listening, start or
     * install Ollama — but only when `serverIsThisMachine()`, so a person
     * visiting a hosted OCADE in Chrome went straight to "unavailable" and
     * OCADE prepared nothing at all. First run on the product's own primary
     * platform did nothing.
     *
     * `brain.warm()` asks for persistent storage, probes WebGPU, falls back to
     * the WASM runtime when there is no usable GPU adapter, and downloads
     * through the resumable, checksum-verified path in `model-download.ts`.
     * Progress reaches this component through the preparation store rather
     * than a callback, because the adapters are shared across tabs and the
     * thing displaying progress is whichever screen happens to be mounted.
     *
     * No button is involved anywhere in this. The user opened OCADE; that is
     * the whole of the consent required to make OCADE work.
     */
    brain.warm();

    // 1. Is a usable engine already here? Then there is nothing to do, and the
    //    user should never learn this check happened.
    const first = await discoverLocalModels(DEFAULT_LOCAL_BRIDGE_URL);
    if (first.ok && first.models.length > 0) {
      setPhase("done");
      return;
    }

    /*
     * 2. Nothing listening on the local bridge.
     *
     * That is no longer a problem: the browser engine above is preparing, and
     * on most devices it is the only engine there will be. Ollama is a bonus
     * for people who happen to run it, so this path is attempted ONLY when the
     * server genuinely is this machine — starting an engine on somebody else's
     * server is both wrong and futile — and its failure is not the product
     * failing.
     */
    if (!first.reachable) {
      if (!serverIsThisMachine()) {
        setPhase("done");
        return;
      }
      setPhase("starting");
      try {
        let startResult = await startLocalRuntimeFn();

        /*
         * NEVER INSTALLED IS NOT THE SAME AS FAILED TO START, AND ONLY ONE OF
         * THEM IS FIXABLE HERE.
         *
         * On a machine that has never had the runtime, `startRuntime` searches
         * its known install paths, finds nothing and returns `binary_not_found`.
         * Until now that was the end: first run stopped, and nothing anywhere
         * would ever install it. Everything else -- a port in use, a refused
         * bind -- is a different problem that installing would not solve, so
         * only this one reason triggers a download.
         */
        if (!startResult.ok && startResult.reason === "binary_not_found") {
          const installed = await installLocalRuntimeFn();
          if (installed.ok) startResult = await startLocalRuntimeFn();
        }

        if (!startResult.ok) {
          recordFailure();
          setPhase("unavailable");
          return;
        }
      } catch {
        recordFailure();
        setPhase("unavailable");
        return;
      }
    }

    /*
     * 3. Engine up, no model. Fetch THE model.
     *
     * This used to call `selectTier` and download whatever tier the hardware
     * was matched to, which is how a machine could end up installing a 14B
     * engine that took three minutes to answer. There is one OCADE model now,
     * so first run installs it and nothing else — the same engine the product
     * documents, on every device.
     */
    setSelection(FIXED_MODEL);
    setPhase("downloading");

    controller.current = new AbortController();
    const pulled = await pullModel(DEFAULT_LOCAL_BRIDGE_URL, FIXED_MODEL.id, {
      expectedBytes: FIXED_MODEL.approxBytes,
      signal: controller.current.signal,
      onProgress: setProgress,
    });

    if (!pulled.ok) {
      /*
       * The optional engine failed, not OCADE. The browser engine warmed at
       * step 0 is what actually answers on this device, so reporting this as
       * "unavailable" would tell a working product it is broken.
       */
      recordFailure();
      setPhase("done");
      return;
    }

    /*
     * A FINISHED TRANSFER IS NOT A WORKING ENGINE, AND LISTING IT DOES NOT
     * PROVE IT EITHER.
     *
     * This used to call `discoverLocalModels` -- a `GET /api/tags` listing --
     * and declare victory when the name came back. That is precisely the
     * "bytes on disk prove transfer, not inference" mistake the lifecycle
     * module refuses to make everywhere else. A truncated or corrupt model
     * lists perfectly well and then fails on the first question the user asks,
     * which is the worst possible moment to discover it.
     *
     * `activateModel` already existed and does the real thing: it sends an
     * actual prompt, requires an actual answer, and proves the stream can be
     * cancelled. It was only ever called from the manual Settings panel. Now
     * the automatic path uses it too.
     */
    const activated = await activateModel(FIXED_MODEL.id, {
      runInference: async (id, prompt) => {
        let text = "";
        const reply = await streamLocalChat(
          DEFAULT_LOCAL_BRIDGE_URL,
          id,
          [{ role: "user", content: prompt }],
          { onToken: (token) => (text += token) },
        );
        return { ok: reply.ok, text };
      },
      runCancellable: async (id) => {
        const abort = new AbortController();
        setTimeout(() => abort.abort(), 800);
        const reply = await streamLocalChat(
          DEFAULT_LOCAL_BRIDGE_URL,
          id,
          [{ role: "user", content: "Count slowly from 1 to 900, one per line." }],
          { onToken: () => {}, signal: abort.signal },
        );
        return { cancelled: reply.ok === false && reply.reason === "cancelled" };
      },
    });

    if (!activated.ok) {
      recordFailure();
      setPhase("done");
      return;
    }

    // Only now is setup genuinely complete: the model is installed, it answered
    // a real question, and it stopped when asked.
    clearFailures();
    markAttempted();
    setPhase("done");
    // No dependencies: this decides nothing from the device any more. It
    // checks whether the engine is present and, if not, installs THE engine.
  }, [brain]);

  useEffect(() => {
    if (started.current) return;
    // Wait for the device measurement: choosing a tier before knowing the
    // device is how a phone ends up fetching a workstation model.
    if (device.loading) return;
    started.current = true;
    // Success is final; failure is not. Retry on a later visit, up to a limit.
    if (!alreadyAttempted() && failureCount() >= MAX_AUTO_ATTEMPTS) {
      setPhase("unavailable");
      return;
    }
    if (alreadyAttempted()) {
      setPhase("done");
      return;
    }
    void run();
  }, [device.loading, run]);

  useEffect(() => () => controller.current?.abort(), []);

  /*
   * WHAT THE PILL SHOWS, AND WHY IT PREFERS THE BROWSER.
   *
   * Two things can be preparing: the browser engine (the one that answers on
   * nearly every device) and the optional local runtime. The browser is shown
   * when it is working, because that is the transfer the user is actually
   * waiting on. The runtime's own progress is the fallback.
   *
   * `unsupported` is shown too, briefly and honestly: a browser that cannot
   * run any on-device engine is not a spinner that will eventually finish, and
   * leaving the pill silent there would mean waiting forever for nothing.
   */
  const browserBusy =
    preparation?.stage === "checking" ||
    preparation?.stage === "downloading" ||
    preparation?.stage === "loading" ||
    preparation?.stage === "retrying";
  const runtimeBusy = phase === "downloading" || phase === "starting";
  if (!browserBusy && !runtimeBusy && preparation?.stage !== "unsupported") return null;

  const percent = browserBusy
    ? preparation?.fraction === null || preparation?.fraction === undefined
      ? null
      : preparation.fraction * 100
    : (progress?.percent ?? null);

  const label = browserBusy
    ? describePreparation(preparation!)
    : preparation?.stage === "unsupported"
      ? describePreparation(preparation)
      : percent === null
        ? "Preparing OCADE Intelligence…"
        : `Preparing OCADE Intelligence — ${Math.round(percent)}%`;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-40 w-[min(19rem,calc(100vw-2rem))]"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden />
          <span className="truncate text-[13px] font-medium text-foreground">{label}</span>
        </div>
        {percent !== null ? (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
        ) : null}
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          {preparation?.stage === "unsupported"
            ? "You can still use everything else. Manage this in Settings › Local Engine."
            : selection || browserBusy
              ? "Runs privately on this device. Nothing to install, and you can keep working."
              : "Getting this device ready."}
        </p>
      </div>
    </div>
  );
}
