import {
  PROMOTION_LATENCY_CEILING_MS,
  type BrowserEngineKind,
  type TierBenchmark,
} from "./browser-catalogue";

/**
 * What this device has actually proven it can run.
 *
 * Promotion to a larger browser model happens on evidence and nothing else, so
 * the evidence has to survive a reload — otherwise every visit starts from
 * zero and nobody is ever promoted.
 *
 * PER BROWSER, NOT PER ACCOUNT. This describes the machine in front of the
 * user, and syncing it would tell a phone that a workstation's result applies
 * to it. That is the same class of mistake as reading the server's RAM and
 * calling it the user's.
 */

const KEY = "ocade.brain.tier-benchmark.v1";

type Stored = Partial<Record<BrowserEngineKind, TierBenchmark>>;

function read(): Stored {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Stored;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    // A corrupt record means "no evidence", which lands on the smallest model.
    // That is the safe direction, so it is not worth reporting.
    return {};
  }
}

export function loadBenchmark(kind: BrowserEngineKind): TierBenchmark | null {
  const entry = read()[kind];
  if (
    !entry ||
    typeof entry.provenRank !== "number" ||
    typeof entry.firstTokenMs !== "number" ||
    entry.provenRank < 0 ||
    entry.firstTokenMs <= 0
  ) {
    return null;
  }
  return entry;
}

/**
 * Record a completed generation.
 *
 * Only a SUCCESSFUL, non-cancelled generation counts, and only an improvement
 * is written — a single slow run on a busy machine should not demote a device
 * that has already proven itself, and a cancelled run measures the user's
 * patience rather than the hardware.
 */
export function recordBenchmark(kind: BrowserEngineKind, rank: number, firstTokenMs: number): void {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(firstTokenMs) || firstTokenMs <= 0) return;
  // Too slow to justify anything larger, so it is not evidence for promotion.
  if (firstTokenMs > PROMOTION_LATENCY_CEILING_MS) return;

  try {
    const all = read();
    const existing = all[kind];
    if (existing && existing.provenRank > rank) return;
    if (existing && existing.provenRank === rank && existing.firstTokenMs <= firstTokenMs) return;
    all[kind] = { provenRank: rank, firstTokenMs: Math.round(firstTokenMs) };
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // A browser refusing storage simply never promotes. Acceptable: the
    // smallest engine works, it is only slower to get better ones.
  }
}

/** Forget everything measured here. Used by the storage settings page. */
export function clearBenchmarks(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
