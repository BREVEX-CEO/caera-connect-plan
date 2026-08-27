/**
 * The 28-minute demo session and its device-local 28-hour reset window.
 *
 * A demo that never ends is a free tier nobody asked for; a demo that ends
 * without warning loses the user's work and their goodwill in the same second.
 * So the session has a fixed length, a visible clock, a warning before it goes,
 * and a defined end state — generation stopped, temporary conversations cleared,
 * user returned to the landing page.
 *
 * THE CLOCK IS ABSOLUTE, NOT A COUNTDOWN. It is stored as a wall-clock deadline
 * rather than as "minutes remaining" ticked down by a timer. A background tab
 * throttles `setInterval` to once a minute or stops it entirely, and a laptop
 * that sleeps stops it completely — a counter would come back showing time the
 * user never spent. Every read recomputes from `Date.now()`, so closing the lid
 * for an hour ends the session, which is the truthful outcome.
 *
 * AN ABSOLUTE DEADLINE IS ONLY HONEST IN ONE DIRECTION. Reading `Date.now()`
 * means a clock moved FORWARD ends the session, which is right — a laptop that
 * slept for an hour really did spend that hour. It also means a clock moved
 * BACKWARD extends it, and unlike sleeping, that is something a person can do
 * on purpose: set the system clock back twenty minutes and the demo restarts
 * itself, indefinitely, for free. `observeNow` closes that by remembering the
 * furthest forward this browser has ever seen the clock and refusing to accept
 * anything earlier. Time can still pass; it can no longer un-pass.
 *
 * Pure and injectable: `now` is a parameter everywhere, so expiry, the warning
 * threshold and the boundary between them are all reachable from a test without
 * waiting 28 minutes.
 */

/**
 * Session length. THE ONE PLACE IT IS DECIDED.
 *
 * Every surface — the badge, the warning, the progress ring, the expiry handler
 * — derives from this constant, so the demo cannot be eight minutes in the copy
 * and something else in the timer. Changing this number changes the demo; there
 * is no second duration anywhere that could disagree with it.
 */
export const DEMO_SESSION_MS = 28 * 60 * 1000;

/** One demo per durable browser profile during this reset window. */
export const DEMO_RESET_MS = 28 * 60 * 60 * 1000;

/**
 * How long before the end the user is warned.
 *
 * Three minutes is enough to finish a thought and copy something out, and short
 * enough that the warning still reads as urgent rather than as furniture.
 */
export const DEMO_WARNING_MS = 3 * 60 * 1000;

const STORAGE_KEY = "caera:demo:session:v2";
const NEXT_ELIGIBLE_KEY = "caera:demo:next-eligible:v1";
/** The furthest forward this browser has ever seen the clock. */
const HIGH_WATER_KEY = "caera:demo:seen-at:v1";

export type DemoPhase =
  /** No session has been started in this browser. */
  | "idle"
  /** Running, with time to spare. */
  | "active"
  /** Running, inside the warning window. */
  | "ending"
  /** The deadline has passed. */
  | "expired";

export interface DemoSessionState {
  phase: DemoPhase;
  /** Wall-clock deadline, or null when idle. */
  expiresAt: number | null;
  /** Milliseconds left, floored at zero. */
  remainingMs: number;
  /** 0–1 elapsed, for a progress ring. */
  elapsedFraction: number;
}

/** Read the stored deadline. Never throws — storage can be unavailable. */
export function readDeadline(storage?: Pick<Storage, "getItem">): number | null {
  const store = storage ?? safeLocal();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Read when this durable browser profile may start another demo. */
export function readNextEligibleAt(storage?: Pick<Storage, "getItem">): number | null {
  const store = storage ?? safeLocal();
  if (!store) return null;
  try {
    const raw = store.getItem(NEXT_ELIGIBLE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * The current time, as far as this browser is willing to believe it.
 *
 * Returns the greater of the clock and the highest value previously seen, and
 * records the result. So:
 *
 *   - Ordinary use: `now` always advances, the high-water mark follows it, and
 *     this returns `now`. No behaviour changes at all.
 *   - Clock set backwards: `now` is below the mark, the mark is returned, and
 *     the deadline the session was given still arrives on time.
 *   - Clock set forwards: accepted, and permanently. That is the same outcome
 *     as leaving the laptop shut, which is the truthful one — and a visitor
 *     who jumps their clock forward to skip the demo has only ended it sooner.
 *
 * With no durable storage there is nothing to compare against, so the clock is
 * used as given. That case already fails closed in `startSession`, which
 * refuses to begin a session it cannot bound.
 */
export function observeNow(now: number, storage?: Pick<Storage, "getItem" | "setItem">): number {
  const store = storage ?? safeLocal();
  if (!store) return now;
  let seen = 0;
  try {
    const raw = store.getItem(HIGH_WATER_KEY);
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) seen = value;
  } catch {
    return now;
  }
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
 * Begin a session, or return the one already running.
 *
 * Deliberately NOT restarting an existing session: a visitor who opens the demo
 * in a second tab, or reloads, must not be handed a fresh 28 minutes. The
 * deadline is set once and every surface reads the same one.
 */
export function startSession(
  now: number,
  storage?: Pick<Storage, "getItem" | "setItem">,
): number | null {
  const store = storage ?? safeLocal();
  if (!store) return null;
  const existing = readDeadline(store as Pick<Storage, "getItem"> | undefined);
  if (existing !== null && existing > now) return existing;

  const nextEligibleAt = readNextEligibleAt(store);
  if (nextEligibleAt !== null && nextEligibleAt > now) return null;

  const deadline = now + DEMO_SESSION_MS;
  try {
    store.setItem(STORAGE_KEY, String(deadline));
    store.setItem(NEXT_ELIGIBLE_KEY, String(now + DEMO_RESET_MS));
  } catch {
    // A once-per-reset-window rule cannot be enforced without durable state.
    // Fail closed rather than silently handing private/incognito reloads an
    // unlimited demo.
    return null;
  }
  return deadline;
}

/** Clear the session. Used at expiry and when the visitor leaves deliberately. */
export function endSession(storage?: Pick<Storage, "removeItem">): void {
  const store = storage ?? safeLocal();
  try {
    store?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up if storage is unavailable */
  }
}

/** Human-readable reset time for the sign-in handoff. */
export function formatResetRemaining(nextEligibleAt: number | null, now: number): string {
  if (nextEligibleAt === null || nextEligibleAt <= now) return "now";
  const totalMinutes = Math.ceil((nextEligibleAt - now) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"}${minutes ? ` ${minutes} minutes` : ""}`;
}

/**
 * Derive the whole visible state from a deadline and the current time.
 *
 * One pure function so the badge, the warning and the expiry handler can never
 * disagree about which phase the session is in.
 */
export function sessionState(deadline: number | null, now: number): DemoSessionState {
  if (deadline === null) {
    return { phase: "idle", expiresAt: null, remainingMs: 0, elapsedFraction: 0 };
  }
  const remainingMs = Math.max(0, deadline - now);
  const elapsedFraction = Math.min(1, Math.max(0, 1 - remainingMs / DEMO_SESSION_MS));
  const phase: DemoPhase =
    remainingMs <= 0 ? "expired" : remainingMs <= DEMO_WARNING_MS ? "ending" : "active";
  return { phase, expiresAt: deadline, remainingMs, elapsedFraction };
}

/**
 * The clock as a person reads it.
 *
 * `m:ss` under ten minutes and whole minutes above it. The longer opening
 * portion stays calm by showing whole minutes; the final ten minutes expose
 * seconds so the end of the session is unambiguous.
 */
export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 10) return `${minutes} min left`;
  return `${minutes}:${String(seconds).padStart(2, "0")} left`;
}

/** The sentence shown when the warning window opens. */
export function warningMessage(remainingMs: number): string {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Your demo ends in about ${minutes} minute${minutes === 1 ? "" : "s"}. Anything here is temporary — create an account to keep your conversations.`;
}

function safeLocal(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
