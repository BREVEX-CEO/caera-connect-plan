/**
 * Automatic visual-performance fallback.
 *
 * Accessibility and performance are deliberately separate policies. Reduced
 * motion may make the interface static because the user asked for that.
 * Performance fallback only makes effects cheaper; it must never make OCADE
 * look broken or motionless on an ordinary laptop.
 */

export type PerfFallbackTrigger = "device" | "frames";

export interface DeviceSignals {
  /** navigator.hardwareConcurrency, when the browser reports it. */
  cores?: number;
  /** navigator.deviceMemory in GB, Chromium only. */
  memoryGb?: number;
  /** Browser-level Save-Data request. Used by network/model policy, not UI motion. */
  saveData?: boolean;
  viewportWidth?: number;
}

export interface DeviceAssessment {
  /** True only when static hardware evidence is genuinely constrained. */
  lowEnd: boolean;
  /** Plain-language phrase naming the signal that decided it. */
  reason: string | null;
}

/**
 * Static fallback is intentionally narrow.
 *
 * Four-core / 4 GB browser reports are common and are not evidence that a UI
 * should become static. Save-Data is also not a rendering signal: it prevents
 * large automatic network transfers elsewhere in OCADE, but does not disable
 * animation. Unknown values remain capable rather than punishing Safari and
 * Firefox for not exposing these hints.
 */
export function assessDevice(signals: DeviceSignals): DeviceAssessment {
  if (typeof signals.memoryGb === "number" && signals.memoryGb > 0 && signals.memoryGb <= 2) {
    return { lowEnd: true, reason: `this device reports ${signals.memoryGb} GB of memory` };
  }
  if (typeof signals.cores === "number" && signals.cores > 0 && signals.cores <= 2) {
    return {
      lowEnd: true,
      reason: `this device reports ${signals.cores} processor core${signals.cores === 1 ? "" : "s"}`,
    };
  }
  return { lowEnd: false, reason: null };
}

/** Read live browser signals. Safe during SSR. */
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
 * Performance fallback keeps motion alive while reducing expensive layers.
 * Controls, content, route transitions and direct-manipulation feedback remain.
 */
export const FALLBACK_CHANGES: string[] = [
  "Heavy background blur is reduced so panels require less compositing work.",
  "The landing universe uses its reduced render tier while planets and direct interactions keep moving.",
  "Pointer depth is shallower and decorative particle density is reduced, not removed.",
  "Long transitions are shortened. Text, colour, contrast and every control are unchanged.",
];

/** One sentence naming the trigger, for the top of the notice. */
export function describeTrigger(trigger: PerfFallbackTrigger, reason: string | null): string {
  if (trigger === "frames") {
    return "OCADE measured sustained slow foreground frames, so it reduced visual cost while keeping interaction and essential motion active.";
  }
  return `OCADE reduced visual cost before drawing because ${reason ?? "this device reported very limited resources"}.`;
}
