/**
 * How long the first run actually takes, measured without reading anything
 * private.
 *
 * WHY MEASURE AT ALL. "Make it fast" is not a thing anybody can do without
 * knowing which stage is slow, and the stages have completely different fixes:
 * a slow device check is a probe doing too much, a slow transfer is a
 * distribution problem, a slow load is a runtime problem, and a high retry
 * count is a network problem masquerading as all three. Guessing between them
 * is how a week gets spent optimising the stage that was already fast.
 *
 * WHAT IS DELIBERATELY NOT IN HERE, and cannot be added by accident. There is
 * no free-text field on any event. The union below is exhaustive and every
 * value is a number, a boolean, or a member of a small closed set. So there is
 * nowhere for a prompt, a conversation, a model's output, a file name, a URL,
 * or a user identifier to be put — not because a reviewer would notice, but
 * because the type would not compile.
 *
 * `reason` on the two failure events is the one string, and it is a message
 * this codebase wrote for a screen, never anything the user or the model
 * produced.
 *
 * IT STAYS ON THE DEVICE UNLESS SOMETHING IS EXPLICITLY WIRED TO SEND IT. This
 * module keeps a bounded ring in memory and exposes it to the diagnostics
 * surface. There is no network call here, and adding one is a decision
 * somebody has to make on purpose.
 */

export type InstallTelemetry =
  | { kind: "device_checked"; ms: number; paths: number }
  | { kind: "adopted_existing"; version: string }
  | {
      kind: "downloaded";
      version: string;
      ms: number;
      bytes: number;
      resumedBytes: number;
      retries: number;
      sourceKind: "ocade_cdn" | "same_origin" | "publisher";
      ranged: boolean;
      concurrency: number;
      bytesPerSecond: number | null;
    }
  | { kind: "digest_mismatch"; version: string }
  | { kind: "handed_off"; version: string; to: string }
  | { kind: "loaded"; path: string; ms: number }
  | { kind: "threads"; path: string; multithreaded: boolean; threads: number }
  | { kind: "ready"; path: string; msFromStart: number | null }
  | { kind: "path_failed"; path: string; reason: string }
  | { kind: "failed"; stage: string; reason: string }
  | { kind: "uninstalled"; removed: number };

export interface TimedInstallEvent {
  at: number;
  event: InstallTelemetry;
}

/**
 * Bounded on purpose.
 *
 * An unbounded log of a long-running session is a memory leak that only shows
 * up on the devices least able to afford one. Sixty events covers several
 * complete install attempts, which is what anybody diagnosing this needs.
 */
const MAX_EVENTS = 60;
const ring: TimedInstallEvent[] = [];
const listeners = new Set<(event: TimedInstallEvent) => void>();

export function recordInstallEvent(event: InstallTelemetry): void {
  const timed = { at: Date.now(), event };
  ring.push(timed);
  if (ring.length > MAX_EVENTS) ring.shift();
  for (const listener of listeners) listener(timed);
}

export function installEvents(): readonly TimedInstallEvent[] {
  return ring;
}

export function subscribeToInstallEvents(listener: (event: TimedInstallEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearInstallEvents(): void {
  ring.length = 0;
}

/**
 * The numbers somebody would actually act on, derived from the ring.
 *
 * Every field is null until the corresponding stage has happened, rather than
 * zero. A zero here would read as "instant" and send somebody looking at the
 * wrong stage.
 */
export interface InstallSummary {
  deviceCheckMs: number | null;
  downloadMs: number | null;
  downloadBytes: number | null;
  resumedBytes: number | null;
  bytesPerSecond: number | null;
  retries: number | null;
  sourceKind: string | null;
  ranged: boolean | null;
  concurrency: number | null;
  loadMs: number | null;
  timeToReadyMs: number | null;
  path: string | null;
  /** What the engine actually ran on, not what was asked for. */
  threads: number | null;
  multithreaded: boolean | null;
  failures: number;
}

export function summariseInstall(events: readonly TimedInstallEvent[] = ring): InstallSummary {
  const summary: InstallSummary = {
    deviceCheckMs: null,
    downloadMs: null,
    downloadBytes: null,
    resumedBytes: null,
    bytesPerSecond: null,
    retries: null,
    sourceKind: null,
    ranged: null,
    concurrency: null,
    loadMs: null,
    timeToReadyMs: null,
    path: null,
    threads: null,
    multithreaded: null,
    failures: 0,
  };

  for (const { event } of events) {
    switch (event.kind) {
      case "device_checked":
        summary.deviceCheckMs = event.ms;
        break;
      case "downloaded":
        summary.downloadMs = event.ms;
        summary.downloadBytes = event.bytes;
        summary.resumedBytes = event.resumedBytes;
        summary.bytesPerSecond = event.bytesPerSecond;
        summary.retries = event.retries;
        summary.sourceKind = event.sourceKind;
        summary.ranged = event.ranged;
        summary.concurrency = event.concurrency;
        break;
      case "loaded":
        summary.loadMs = event.ms;
        summary.path = event.path;
        break;
      case "threads":
        summary.threads = event.threads;
        summary.multithreaded = event.multithreaded;
        break;
      case "ready":
        summary.timeToReadyMs = event.msFromStart;
        summary.path = event.path;
        break;
      case "failed":
      case "path_failed":
      case "digest_mismatch":
        summary.failures += 1;
        break;
      default:
        break;
    }
  }
  return summary;
}
