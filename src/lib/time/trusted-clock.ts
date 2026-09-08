/**
 * THE CLOCK OCADE IS WILLING TO BELIEVE.
 *
 * Several things in this product are bounded by wall-clock time that the
 * person being bounded also controls: a commercial usage window that refills
 * on a schedule, a signed offline allowance that must not be replayed, a lease
 * that expires. Reading `Date.now()` directly makes every one of them
 * defeatable by setting the system clock back.
 *
 * ONLY ONE DIRECTION IS DISHONEST. A clock that moved FORWARD is indis-
 * tinguishable from a laptop that was shut for an hour, and treating that hour
 * as spent is the truthful outcome. A clock that moved BACKWARD is something a
 * person does deliberately, and accepting it hands out free windows for as
 * long as they care to keep doing it.
 *
 * So this remembers the furthest forward this browser has ever seen the clock
 * and refuses to report anything earlier. Time can still pass. It can no
 * longer un-pass.
 *
 * This is device-local and erasable, and that is understood rather than
 * defended against: clearing site data resets the mark. It is not a
 * fingerprint and does not try to be. The server remains the authority for
 * account usage — see the commercial usage authority — and this bounds only
 * what a device may decide on its own while offline.
 *
 * Pure and injectable: `now` and the store are parameters, so rollback,
 * jump-forward and the no-storage case are all reachable from a test.
 */

/** The furthest forward this browser has ever seen the clock. */
const HIGH_WATER_KEY = "ocade:trusted-clock:high-water:v1";

type ReadWriteStore = Pick<Storage, "getItem" | "setItem">;

export function readTrustedClockHighWater(storage?: Pick<Storage, "getItem">): number {
  const store = storage ?? safeLocalStorage();
  if (!store) return 0;
  try {
    const value = Number(store.getItem(HIGH_WATER_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * The current time, floored at the highest value previously observed.
 *
 * With no durable storage there is nothing to compare against, so the clock is
 * used as given. Callers that cannot be correct without a bound must fail
 * closed themselves rather than assume this one did — see
 * `hasTrustedClockStorage`.
 */
export function observeNow(now: number, storage?: ReadWriteStore): number {
  const store = storage ?? safeLocalStorage();
  if (!store) return now;

  const seen = readTrustedClockHighWater(store);

  const effective = Math.max(now, seen);
  if (effective > seen) {
    try {
      store.setItem(HIGH_WATER_KEY, String(effective));
    } catch {
      /* Nothing to remember with. The clock is used as given. */
    }
  }
  return effective;
}

/**
 * Whether a monotonic bound can be enforced on this device at all.
 *
 * Anything that must not be replayable — an offline allowance lease above all
 * — checks this and refuses rather than running on an unbounded clock.
 */
export function hasTrustedClockStorage(storage?: ReadWriteStore): boolean {
  const store = storage ?? safeLocalStorage();
  if (!store) return false;
  try {
    store.setItem(HIGH_WATER_KEY, store.getItem(HIGH_WATER_KEY) ?? "0");
    return true;
  } catch {
    return false;
  }
}

/** How long until a future instant, as a person reads it. */
export function formatTimeUntil(target: number | null, now: number): string {
  if (target === null || target <= now) return "now";
  const totalMinutes = Math.ceil((target - now) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"}${minutes ? ` ${minutes} minutes` : ""}`;
}

/**
 * A remaining duration, as a person reads it.
 *
 * Whole minutes above ten minutes and `m:ss` below it: the long middle of a
 * window stays calm, and the last few minutes are unambiguous.
 */
export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 10) return `${minutes} min left`;
  return `${minutes}:${String(seconds).padStart(2, "0")} left`;
}

function safeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
