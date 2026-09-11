/**
 * OCADE Resource Governor (master plan §23.5, and the hardware half of §6.3).
 *
 * Before a heavy job — local inference, a render, a build, a video export, a
 * simulation — estimate what it will cost (memory, storage, time), check that
 * against the machine as it is right now, and either clear it, recommend a
 * lighter setting that fits, or refuse. The failure this prevents is the one
 * the plan names directly: a job that starts, exhausts memory or storage or
 * overheats the machine, and dies partway with nothing to show.
 *
 * TWO HONESTY RULES, because a resource governor is only useful if trusted:
 *
 * 1. **An estimate is bounded and says so.** Cost per work-unit is
 *    approximate; the governor reports a figure with its assumption attached
 *    and never presents it as a measured certainty. When the inputs are too
 *    thin to estimate at all, it refuses to guess rather than emit a number.
 *
 * 2. **Insufficient resources REFUSE, they don't silently proceed.** If the
 *    estimate exceeds available memory or storage, the job does not start on
 *    hope. Where a lighter setting would fit, that is recommended instead of a
 *    bare "no" — but the real thing is never attempted over budget.
 *
 * Pure and offline. It advises; running the job is a separate, gated step.
 */

import { formatNumber } from "@/lib/locale/format";
export type JobKind = "local_inference" | "render" | "build" | "video_export" | "simulation";

export type ThermalState = "nominal" | "warm" | "hot" | "critical";

export interface HardwareSnapshot {
  totalRamBytes: number;
  availableRamBytes: number;
  freeStorageBytes: number;
  hasGpu: boolean;
  /** 0–100. Undefined means mains-powered / no battery (desktop). */
  batteryPercent?: number;
  /** Undefined means unknown; treated conservatively as nominal. */
  thermalState?: ThermalState;
}

export interface JobSpec {
  kind: JobKind;
  /** Primary size driver: tokens, triangles, frames, cells… */
  workUnits: number;
  /** Approximate peak memory per work-unit, in bytes. From the pack/adapter. */
  bytesPerUnit: number;
  /** Approximate wall time per work-unit, in ms. */
  msPerUnit: number;
  /** Output size in bytes, when known. */
  outputBytes?: number;
  /** Fixed overhead the job needs regardless of size (model weights, etc.). */
  fixedMemoryBytes?: number;
}

export type ResourceOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface Estimate {
  peakMemoryBytes: number;
  durationMs: number;
  storageBytes: number;
  /** Always true here — kept explicit so callers never treat it as exact. */
  approximate: true;
  /** The assumption the estimate rests on, stated plainly. */
  basis: string;
}

export type Recommendation =
  | { action: "proceed"; reason: string; estimate: Estimate }
  /** Fits only at a smaller size; the suggested ceiling is given. */
  | { action: "downgrade"; suggestedWorkUnits: number; reason: string; estimate: Estimate }
  /** Long enough that it must be checkpointed so it can pause/resume. */
  | { action: "checkpoint_first"; reason: string; estimate: Estimate }
  /** Defer: the machine is too hot or too low on battery to start now. */
  | { action: "defer"; reason: string; estimate: Estimate }
  /** Won't fit at any reasonable size. */
  | { action: "refuse"; reason: string; estimate: Estimate };

/** Jobs longer than this must be checkpointed rather than run in one shot. */
export const LONG_JOB_MS = 5 * 60 * 1000;
/** Below this battery %, don't start a heavy job unless plugged in. */
export const LOW_BATTERY_PERCENT = 25;
/** Keep this much RAM free for the OS rather than consuming all of it. */
export const RAM_HEADROOM = 0.85;

/**
 * Estimate a job's cost. Refuses to produce a number from nonsense inputs
 * rather than returning a confident-looking zero.
 */
export function estimateJob(spec: JobSpec): ResourceOutcome<Estimate> {
  if (!["local_inference", "render", "build", "video_export", "simulation"].includes(spec.kind)) {
    return { ok: false, reason: "The job kind is unknown, so OCADE won't estimate it." };
  }
  if (!Number.isFinite(spec.workUnits) || spec.workUnits <= 0) {
    return {
      ok: false,
      reason: "The job has no positive work size, so there's nothing to estimate.",
    };
  }
  if (!Number.isFinite(spec.bytesPerUnit) || spec.bytesPerUnit < 0) {
    return {
      ok: false,
      reason:
        "The per-unit memory cost is missing or invalid, so OCADE won't guess the memory need.",
    };
  }
  if (!Number.isFinite(spec.msPerUnit) || spec.msPerUnit < 0) {
    return {
      ok: false,
      reason: "The per-unit time cost is missing or invalid, so OCADE won't guess the duration.",
    };
  }
  if (spec.fixedMemoryBytes !== undefined && !validNonNegativeAmount(spec.fixedMemoryBytes)) {
    return {
      ok: false,
      reason: "The fixed memory cost is invalid, so OCADE won't guess the memory need.",
    };
  }
  if (spec.outputBytes !== undefined && !validNonNegativeAmount(spec.outputBytes)) {
    return {
      ok: false,
      reason: "The output storage cost is invalid, so OCADE won't guess the disk need.",
    };
  }

  const fixed = spec.fixedMemoryBytes ?? 0;
  const peakMemoryBytes = fixed + spec.workUnits * spec.bytesPerUnit;
  const durationMs = spec.workUnits * spec.msPerUnit;
  const storageBytes = spec.outputBytes ?? 0;
  if (
    !validNonNegativeAmount(peakMemoryBytes) ||
    !validNonNegativeAmount(durationMs) ||
    !validNonNegativeAmount(storageBytes)
  ) {
    return {
      ok: false,
      reason: "The estimated resource cost exceeds JavaScript's safe numeric range.",
    };
  }

  return {
    ok: true,
    data: {
      peakMemoryBytes,
      durationMs,
      storageBytes,
      approximate: true,
      basis: `Based on ${formatNumber(spec.workUnits)} units at ~${formatBytes(spec.bytesPerUnit)}/unit and ~${spec.msPerUnit} ms/unit${fixed > 0 ? `, plus ${formatBytes(fixed)} fixed` : ""}. This is an estimate, not a measurement.`,
    },
    evidence: `~${formatBytes(peakMemoryBytes)} peak, ~${formatDuration(durationMs)}, ${storageBytes > 0 ? `~${formatBytes(storageBytes)} output` : "no output written"}.`,
  };
}

/**
 * Decide what to do about a job given the machine's current state.
 *
 * Order of checks matters: environmental blocks (thermal, battery) come first
 * because they mean "not now" regardless of fit; then hard limits (storage,
 * memory) which mean "not like this"; then duration which means "not in one
 * shot".
 */
export function governResources(
  spec: JobSpec,
  hw: HardwareSnapshot,
): ResourceOutcome<Recommendation> {
  const est = estimateJob(spec);
  if (!est.ok) return est;
  const hardwareError = validateHardwareSnapshot(hw);
  if (hardwareError) return { ok: false, reason: hardwareError };
  const estimate = est.data;

  // 1. Environment: too hot or too low on battery to start a heavy job.
  if (hw.thermalState === "critical") {
    return rec({
      action: "defer",
      reason:
        "The machine is critically hot. Starting a heavy job now risks a thermal shutdown — let it cool first.",
      estimate,
    });
  }
  if (
    hw.thermalState === "hot" &&
    (spec.kind === "render" || spec.kind === "simulation" || spec.kind === "local_inference")
  ) {
    return rec({
      action: "defer",
      reason:
        "The machine is running hot; a compute-heavy job would push it further. OCADE recommends waiting until it cools.",
      estimate,
    });
  }
  if (hw.batteryPercent !== undefined && hw.batteryPercent < LOW_BATTERY_PERCENT) {
    return rec({
      action: "defer",
      reason: `Battery is at ${hw.batteryPercent}%. A job estimated at ${formatDuration(estimate.durationMs)} could drain it before finishing — plug in first.`,
      estimate,
    });
  }

  // 2. Storage: a hard wall. No output can be written past a full disk.
  if (estimate.storageBytes > hw.freeStorageBytes) {
    return rec({
      action: "refuse",
      reason: `The output needs about ${formatBytes(estimate.storageBytes)} but only ${formatBytes(hw.freeStorageBytes)} is free. Free up space before running this.`,
      estimate,
    });
  }

  // 3. Memory: refuse over budget; recommend a lighter size where one fits.
  const usableRam = hw.availableRamBytes * RAM_HEADROOM;
  if (estimate.peakMemoryBytes > usableRam) {
    const fixed = spec.fixedMemoryBytes ?? 0;
    const perUnit = spec.bytesPerUnit;
    // Largest work size whose peak fits under the usable ceiling.
    const fits = perUnit > 0 ? Math.floor((usableRam - fixed) / perUnit) : 0;

    if (fits >= 1 && fixed < usableRam) {
      return rec({
        action: "downgrade",
        suggestedWorkUnits: fits,
        reason: `At ${formatNumber(spec.workUnits)} units this needs ~${formatBytes(estimate.peakMemoryBytes)}, over the ~${formatBytes(usableRam)} safely available. It would fit at about ${formatNumber(fits)} units — run it smaller, or in batches.`,
        estimate,
      });
    }
    return rec({
      action: "refuse",
      reason: `This needs ~${formatBytes(estimate.peakMemoryBytes)} of memory but only ~${formatBytes(usableRam)} is safely available, and its fixed overhead alone doesn't fit. OCADE won't start it — it would run out of memory partway.`,
      estimate,
    });
  }

  // 4. Duration: a long job must be checkpointed so it can pause/resume.
  if (estimate.durationMs > LONG_JOB_MS) {
    return rec({
      action: "checkpoint_first",
      reason: `Estimated at ${formatDuration(estimate.durationMs)}. OCADE will checkpoint it so it can pause, resume, and survive an interruption rather than losing the work if it stops.`,
      estimate,
    });
  }

  return rec({
    action: "proceed",
    reason: `Fits comfortably: ~${formatBytes(estimate.peakMemoryBytes)} of the ~${formatBytes(usableRam)} available, ~${formatDuration(estimate.durationMs)}.`,
    estimate,
  });
}

function rec(r: Recommendation): ResourceOutcome<Recommendation> {
  return { ok: true, data: r, evidence: `${r.action}: ${r.reason}` };
}

function validNonNegativeAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

function validateHardwareSnapshot(hw: HardwareSnapshot): string | null {
  if (
    !validNonNegativeAmount(hw.totalRamBytes) ||
    hw.totalRamBytes === 0 ||
    !validNonNegativeAmount(hw.availableRamBytes) ||
    !validNonNegativeAmount(hw.freeStorageBytes)
  ) {
    return "The hardware memory or storage snapshot is invalid.";
  }
  if (hw.availableRamBytes > hw.totalRamBytes) {
    return "Available memory cannot exceed total memory.";
  }
  if (typeof hw.hasGpu !== "boolean") {
    return "The hardware GPU capability is invalid.";
  }
  if (
    hw.batteryPercent !== undefined &&
    (!Number.isFinite(hw.batteryPercent) || hw.batteryPercent < 0 || hw.batteryPercent > 100)
  ) {
    return "The battery percentage is invalid.";
  }
  if (
    hw.thermalState !== undefined &&
    !["nominal", "warm", "hot", "critical"].includes(hw.thermalState)
  ) {
    return "The thermal state is invalid.";
  }
  return null;
}

/* ------------------------------------------------------------ formatting -- */

function formatBytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s >= 10 ? 0 : 1)} s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(m >= 10 ? 0 : 1)} min`;
  return `${(m / 60).toFixed(1)} h`;
}
