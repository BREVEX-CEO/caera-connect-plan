/**
 * Hardware snapshot the application can actually use (W2).
 *
 * WHAT WAS MISSING
 * ----------------
 * `scripts/detect-hardware.mjs` already measured CPU, RAM, disk and GPU
 * properly — but it is a command-line script. The app could not call it, so
 * nothing in OCADE knew what machine it was running on, and the tier matrix in
 * the plan had no input to work from.
 *
 * This module is the shape and the judgement. The measuring lives in
 * `detect.node.ts`, so the policy here stays pure, testable and safe to import
 * from browser or SSR code.
 *
 * THE RULE THAT MATTERS: UNKNOWN IS NOT YES
 * -----------------------------------------
 * A GPU probe can fail, time out, or run on a platform with no probe at all.
 * Treating "we could not tell" as "there is one" would recommend a tier the
 * machine cannot run — and this programme already measured what that looks
 * like: qwen3:14b on a CPU-only 16 GB host managed 1.32-2.98 tok/s, under half
 * of the 8B tier on the same machine. It did not fail, it degraded silently,
 * which is worse. So `unknown` resolves to "no discrete GPU" everywhere a
 * decision is made, and the uncertainty is carried forward for display.
 */

export type GpuPresence = true | false | "unknown";

/** Raw measurements. Every field is observed, or explicitly unknown. */
export interface HardwareSnapshot {
  totalRamBytes: number;
  availableRamBytes: number;
  freeStorageBytes: number;
  cpuCount: number;
  cpuModel: string | null;
  arch: string;
  platform: string;
  /** True, false, or "unknown" when no reliable probe answered. */
  gpuPresent: GpuPresence;
  /** Adapter names as reported, for display and diagnosis. */
  gpuAdapters: string[];
  /** Discrete adapters only — integrated display chips do not count. */
  gpuDiscrete: string[];
  /** Why the GPU answer is what it is, in plain words. */
  gpuReason: string;
  /** True when this is a phone or tablet shell rather than a desktop. */
  isMobile: boolean;
  measuredAt: string;
}

/** The judgement drawn from a snapshot, with its uncertainty preserved. */
export interface HardwareProfile {
  totalRamGib: number;
  availableRamGib: number;
  freeStorageGib: number;
  cpuCount: number;
  /**
   * Whether tier selection should assume acceleration.
   *
   * `false` when the probe said no AND when it could not tell. The separate
   * `gpuCertain` flag is what a UI should use to decide whether to explain
   * itself.
   */
  hasDiscreteGpu: boolean;
  /** False when the probe returned "unknown". */
  gpuCertain: boolean;
  gpuSummary: string;
  isMobile: boolean;
  platform: string;
}

const GIB = 1024 ** 3;
const round = (bytes: number) => Math.round((bytes / GIB) * 100) / 100;

export function profileFrom(snapshot: HardwareSnapshot): HardwareProfile {
  // "unknown" collapses to false here, deliberately and in one place.
  const hasDiscreteGpu = snapshot.gpuPresent === true;
  const gpuCertain = snapshot.gpuPresent !== "unknown";

  const gpuSummary = !gpuCertain
    ? `Could not determine whether this machine has a graphics card (${snapshot.gpuReason}). Assuming it does not, which is the safe direction.`
    : hasDiscreteGpu
      ? `Discrete graphics detected: ${snapshot.gpuDiscrete.join(", ")}.`
      : snapshot.gpuAdapters.length > 0
        ? `Integrated graphics only (${snapshot.gpuAdapters.join(", ")}), which does not accelerate local models.`
        : "No graphics adapter reported.";

  return {
    totalRamGib: round(snapshot.totalRamBytes),
    availableRamGib: round(snapshot.availableRamBytes),
    freeStorageGib: round(snapshot.freeStorageBytes),
    cpuCount: snapshot.cpuCount,
    hasDiscreteGpu,
    gpuCertain,
    gpuSummary,
    isMobile: snapshot.isMobile,
    platform: snapshot.platform,
  };
}

/**
 * A snapshot to fall back on when measurement itself fails.
 *
 * Not a guess at the real machine — every number is zero and the GPU is
 * unknown, so any tier decision made from it lands on the smallest, safest
 * option rather than an optimistic one.
 */
export function unknownSnapshot(
  platform = "unknown",
  reason = "measurement failed",
): HardwareSnapshot {
  return {
    totalRamBytes: 0,
    availableRamBytes: 0,
    freeStorageBytes: 0,
    cpuCount: 0,
    cpuModel: null,
    arch: "unknown",
    platform,
    gpuPresent: "unknown",
    gpuAdapters: [],
    gpuDiscrete: [],
    gpuReason: reason,
    isMobile: false,
    measuredAt: new Date(0).toISOString(),
  };
}
