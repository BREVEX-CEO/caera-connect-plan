import { useCallback, useEffect, useRef, useState } from "react";
import { startLocalRuntimeFn } from "@/lib/local-runtime.functions";
import { pullModel, type PullProgress } from "@/lib/local/model-lifecycle";
import { discoverLocalModels, DEFAULT_LOCAL_BRIDGE_URL } from "@/lib/ocade-local";
import { serverIsThisMachine } from "@/lib/hardware/detect.browser";
import { useDevicePolicy } from "@/lib/use-device-policy";
import {
  detectPlatform,
  formatBytes,
  resolveFixedModel,
  storagePreflight,
  type StorageDecision,
} from "@/lib/local/fixed-model";

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
 * WHICH ENGINE: decided by platform, not by this machine's specification.
 *
 * This used to call `selectTier(device.profile, manifest)` — a hardware read
 * that picked between model sizes, and one of the five inputs that could
 * disagree with the router about the same computer. There is one desktop model
 * and one mobile model now, so the manifest and the tier selection are gone
 * from this path entirely.
 */
const FIXED_SPEC = resolveFixedModel(detectPlatform());

/**
 * Remembered per browser so a failed attempt does not repeat on every
 * navigation. The Local Engine settings page clears it to retry.
 */
export const ENGINE_AUTOSETUP_KEY = "ocade.engine.autosetup.v1";

type Phase =
  | "idle"
  | "checking"
  | "starting"
  | "downloading"
  | "done"
  | "unavailable"
  // Distinct from "unavailable": nothing is broken, the disk is simply full.
  // Collapsing the two would send someone to diagnostics for a problem they
  // could fix in a minute by clearing space.
  | "insufficient_storage";

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
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const [storage, setStorage] = useState<StorageDecision | null>(null);
  const started = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    setPhase("checking");

    // 1. Is a usable engine already here? Then there is nothing to do, and the
    //    user should never learn this check happened.
    const first = await discoverLocalModels(DEFAULT_LOCAL_BRIDGE_URL);
    if (first.ok && first.models.length > 0) {
      setPhase("done");
      return;
    }

    // 2. Nothing listening. Only try to START a runtime when the server really
    //    is this machine — otherwise that would mean starting an engine on
    //    somebody else's server, which is both wrong and futile.
    if (!first.reachable) {
      if (!serverIsThisMachine()) {
        setPhase("unavailable");
        return;
      }
      setPhase("starting");
      try {
        const startResult = await startLocalRuntimeFn();
        if (!startResult.ok) {
          markAttempted();
          setPhase("unavailable");
          return;
        }
      } catch {
        markAttempted();
        setPhase("unavailable");
        return;
      }
    }

    /*
     * 3. Engine up, no model. There is nothing to choose — this platform has
     *    one engine — so the only question left is whether it will fit.
     *
     *    THE SHORTFALL IS NAMED, NOT SWALLOWED. A bare "not enough space"
     *    makes someone guess how much to clear. Required, available and the
     *    difference are all reported, and the setup stops rather than retrying
     *    into a disk that cannot take it. Nothing is deleted to make room.
     */
    // The measured profile reports gibibytes, rounded. Converting here rather
    // than trusting a byte field that does not exist on it — the typechecker
    // caught that, and a silently-undefined free-space figure would have
    // skipped the check entirely and let the download start on a full disk.
    const freeGib = device.profile?.freeStorageGib;
    const free = typeof freeGib === "number" ? Math.round(freeGib * 1024 ** 3) : undefined;
    if (typeof free === "number") {
      const room = storagePreflight(FIXED_SPEC, free);
      if (!room.ok) {
        setStorage(room);
        markAttempted();
        setPhase("insufficient_storage");
        return;
      }
    }
    setPhase("downloading");

    controller.current = new AbortController();
    const pulled = await pullModel(DEFAULT_LOCAL_BRIDGE_URL, FIXED_SPEC.id, {
      expectedBytes: FIXED_SPEC.approxBytes,
      ...(typeof free === "number" ? { freeStorageBytes: free } : {}),
      signal: controller.current.signal,
      onProgress: setProgress,
    });

    markAttempted();
    if (!pulled.ok) {
      setPhase("unavailable");
      return;
    }

    // A finished transfer is not a working engine. Only a model the runtime
    // will actually list counts as ready.
    const confirmed = await discoverLocalModels(DEFAULT_LOCAL_BRIDGE_URL);
    setPhase(confirmed.ok && confirmed.models.length > 0 ? "done" : "unavailable");
  }, [device.profile]);

  useEffect(() => {
    if (started.current) return;
    // Wait for the device measurement: choosing a tier before knowing the
    // device is how a phone ends up fetching a workstation model.
    if (device.loading) return;
    started.current = true;
    if (alreadyAttempted()) {
      setPhase("done");
      return;
    }
    void run();
  }, [device.loading, run]);

  useEffect(() => () => controller.current?.abort(), []);

  // Silent in every state except active work.
  if (phase !== "downloading" && phase !== "starting" && phase !== "insufficient_storage") {
    return null;
  }

  const percent = progress?.percent ?? null;
  const label =
    phase === "insufficient_storage"
      ? "Not enough space for OCADE's engine"
      : phase === "starting" || percent === null
        ? "Preparing OCADE"
        : `Setting up OCADE · ${Math.round(percent)}%`;

  /*
   * Real figures, not a spinner. Someone watching several gigabytes arrive is
   * entitled to know how many have landed and how many are left; a percentage
   * alone hides a stall, and an unlabelled spinner hides everything.
   */
  const transferred =
    progress?.completedBytes !== undefined && progress.completedBytes > 0
      ? `${formatBytes(progress.completedBytes)} of ${formatBytes(progress.totalBytes ?? FIXED_SPEC.approxBytes)}`
      : null;

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
        {phase === "insufficient_storage" && storage ? (
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            OCADE needs {formatBytes(storage.requiredBytes)} and this device has{" "}
            {formatBytes(storage.availableBytes)} free — {formatBytes(storage.shortfallBytes)}{" "}
            short. Free up space and reopen OCADE, or keep using it with cloud processing, which
            needs no local model. Nothing was downloaded and nothing was deleted.
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            {transferred
              ? `${transferred} · runs privately on this device. Pause or cancel in Settings › Local Engine.`
              : "Getting this device ready."}
          </p>
        )}
      </div>
    </div>
  );
}
