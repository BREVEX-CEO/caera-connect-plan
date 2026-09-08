/**
 * UPTIME, MEASURED RATHER THAN CLAIMED.
 *
 * PLAN.md §K: "Do not invent historical uptime or incidents. Begin measurements
 * from the first verified observation." Every percentage on a status page is
 * either a measurement or a marketing number, and the two look identical, so
 * this module can only ever report over samples it actually holds — and always
 * says how many, and since when.
 *
 * WHERE THE SAMPLES LIVE, AND WHAT THAT HONESTLY MEANS. They are recorded in
 * the visitor's browser, one per check. That makes this a record of what THIS
 * browser has observed, not a fleet-wide history, and `describeWindow` says so
 * in the words the page prints. A cross-visitor history needs a store OCADE
 * does not yet have, and inventing one out of local samples would be exactly
 * the invented history the plan forbids.
 *
 * The arithmetic is pure and the storage is injected, so both halves are
 * testable and neither can quietly acquire the other's assumptions.
 */

import type { ComponentState } from "./state";

export interface UptimeSample {
  /** ISO instant of the observation. */
  at: string;
  state: ComponentState;
}

export interface UptimeWindow {
  samples: number;
  /** Null until at least one sample exists — never 100% on no data. */
  percentage: number | null;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
}

/**
 * How many samples are kept per component.
 *
 * Bounded because this lives in a storage quota shared with the rest of the
 * product, and an unbounded history is how a status page ends up evicting
 * somebody's draft.
 */
export const MAX_SAMPLES = 200;

/**
 * Add a sample, keeping the most recent `MAX_SAMPLES`.
 *
 * Pure: returns a new list rather than mutating, so a caller cannot half-apply
 * a change and leave the stored history inconsistent with what it just showed.
 */
export function recordSample(
  history: readonly UptimeSample[],
  sample: UptimeSample,
): UptimeSample[] {
  return [...history, sample].slice(-MAX_SAMPLES);
}

/**
 * Summarise a component's history.
 *
 * `unknown` samples are EXCLUDED from the denominator rather than counted as
 * failures. A check that could not run is not evidence that the component was
 * down, and counting it as one produces a falling uptime figure caused by the
 * observer rather than by the service.
 */
export function summariseUptime(history: readonly UptimeSample[]): UptimeWindow {
  const measured = history.filter((sample) => sample.state !== "unknown");
  if (!measured.length) {
    return {
      samples: 0,
      percentage: null,
      firstObservedAt: history[0]?.at ?? null,
      lastObservedAt: history[history.length - 1]?.at ?? null,
    };
  }
  const up = measured.filter((sample) => sample.state === "operational").length;
  return {
    samples: measured.length,
    // Rounded to one decimal: a status page that prints 99.87654% is asserting
    // a precision that five samples cannot support.
    percentage: Math.round((up / measured.length) * 1000) / 10,
    firstObservedAt: measured[0].at,
    lastObservedAt: measured[measured.length - 1].at,
  };
}

/**
 * The sentence printed beside a percentage.
 *
 * It always carries the sample count and the start of the record, because
 * "100%" over three checks made in the last minute is true and means nothing,
 * and a reader given only the number cannot tell.
 */
export function describeWindow(window: UptimeWindow): string {
  if (!window.samples || window.percentage === null) {
    return "No checks recorded in this browser yet.";
  }
  const since = window.firstObservedAt
    ? new Date(window.firstObservedAt).toLocaleString()
    : "an unknown time";
  return `${window.percentage}% over ${window.samples} check${
    window.samples === 1 ? "" : "s"
  } made in this browser since ${since}. This is not a fleet-wide uptime history.`;
}

/* ---- storage ---- */

export interface SampleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = "ocade.status.samples";

function browserStorage(): SampleStorage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read every component's sample history.
 *
 * VALIDATES. Storage is writable by anything on the origin, and a fabricated
 * history is the one thing this module exists to prevent — so a sample without
 * a real instant and a known state is discarded rather than counted.
 */
export function readSamples(
  storage: SampleStorage | null = browserStorage(),
): Record<string, UptimeSample[]> {
  if (!storage) return {};
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, UptimeSample[]> = {};
    for (const [componentId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      const samples = value.filter(isSample).slice(-MAX_SAMPLES);
      if (samples.length) out[componentId] = samples;
    }
    return out;
  } catch {
    return {};
  }
}

const STATES = new Set<ComponentState>(["operational", "degraded", "outage", "unknown"]);

function isSample(value: unknown): value is UptimeSample {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { at?: unknown; state?: unknown };
  if (typeof candidate.at !== "string" || Number.isNaN(Date.parse(candidate.at))) return false;
  return typeof candidate.state === "string" && STATES.has(candidate.state as ComponentState);
}

/** Write the histories back. A storage failure loses samples and nothing else. */
export function writeSamples(
  samples: Record<string, readonly UptimeSample[]>,
  storage: SampleStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(samples));
  } catch {
    /* Quota, private mode, or policy. The status page still works. */
  }
}
