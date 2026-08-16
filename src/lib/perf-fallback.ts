/**
 * Automatic performance fallback.
 *
 * TWO SIGNALS, NOT ONE. A device can be slow before it has drawn anything
 * (few cores, little memory, the browser's own data-saver request), and a
 * device that looked capable can still stutter once the scene is running. The
 * first is a STATIC check taken once at start-up so the very first frame is
 * already cheap; the second is the MEASURED check the rAF sampler feeds in.
 *
 * IT MUST EXPLAIN ITSELF. Silently degrading somebody's interface and saying
 * nothing is indistinguishable from the product being broken. Every trigger
 * carries the signal that caused it and the exact list of what was turned
 * down, so the settings panel can state both — and the person can put it back.
 */

export type PerfFallbackTrigger = "device" | "frames";

export interface DeviceSignals {
  /** navigator.hardwareConcurrency, when the browser reports it. */
  cores?: number;
  /** navigator.deviceMemory in GB, Chromium only. */
  memoryGb?: number;
  /** Browser-level data saver / "reduce data" request. */
  saveData?: boolean;
  viewportWidth?: number;
}

export interface DeviceAssessment {
  /** True when the static signals alone justify stepping the scene down. */
  lowEnd: boolean;
  /** Plain-language phrase naming the signal that decided it. */
  reason: string | null;
}

/**
 * Judge the machine from what the browser will tell us before rendering.
 *
 * Thresholds are deliberately conservative: four cores or less, or 4 GB or
 * less of reported memory, is where the layered-blur composite starts costing
 * more than one frame on the hardware we have measured. Unknown values are
 * treated as capable — guessing "slow" from missing data would step down every
 * Safari and Firefox visitor, who report neither.
 */
export function assessDevice(signals: DeviceSignals): DeviceAssessment {
  if (signals.saveData) {
    return { lowEnd: true, reason: "your browser is asking sites to use less data and power" };
  }
  if (typeof signals.memoryGb === "number" && signals.memoryGb > 0 && signals.memoryGb <= 4) {
    return { lowEnd: true, reason: `this device reports ${signals.memoryGb} GB of memory` };
  }
  if (typeof signals.cores === "number" && signals.cores > 0 && signals.cores <= 4) {
    return {
      lowEnd: true,
      reason: `this device reports ${signals.cores} processor core${signals.cores === 1 ? "" : "s"}`,
    };
  }
  return { lowEnd: false, reason: null };
}

/** Read the signals from the live browser. Safe to call during SSR. */
export function readDeviceSignals(): DeviceSignals {
  if (typeof navigator === "undefined") return {};
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    cores: nav.hardwareConcurrency,
    memoryGb: nav.deviceMemory,
    saveData: nav.connection?.saveData === true,
    viewportWidth: typeof window === "undefined" ? undefined : window.innerWidth,
  };
}

/**
 * Exactly what the fallback turns down.
 *
 * Kept as data so the notice, the tests and any future surface all quote the
 * same list. Nothing here removes a control, hides content or changes a
 * colour — that distinction is the point of the copy.
 */
export const FALLBACK_CHANGES: string[] = [
  "Background blur on panels is switched off, so surfaces paint in one pass.",
  "The animated landing scene and ambient glow stop; a still frame stays in place.",
  "Pointer-following depth and the cursor trail are disabled.",
  "Long transitions are shortened. Text, colour, contrast and every control are unchanged.",
];

/** One sentence naming the trigger, for the top of the notice. */
export function describeTrigger(trigger: PerfFallbackTrigger, reason: string | null): string {
  if (trigger === "frames") {
    return "OCADE measured dropped frames while the interface was animating, so it stepped the visuals down to keep scrolling and typing responsive.";
  }
  return `OCADE stepped the visuals down before drawing because ${reason ?? "this device reported limited resources"}.`;
}
