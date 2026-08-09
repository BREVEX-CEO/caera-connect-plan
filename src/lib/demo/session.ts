/**
 * The 28-minute demo session.
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
 * Pure and injectable: `now` is a parameter everywhere, so expiry, the warning
 * threshold and the boundary between them are all reachable from a test without
 * waiting 28 minutes.
 */

/** Session length. The product's recurring number, and long enough to matter. */
export const DEMO_SESSION_MS = 28 * 60 * 1000;

/**
 * How long before the end the user is warned.
 *
 * Three minutes is enough to finish a thought and copy something out, and short
 * enough that the warning still reads as urgent rather than as furniture.
 */
export const DEMO_WARNING_MS = 3 * 60 * 1000;

const STORAGE_KEY = "caera:demo:session:v1";

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
  const store = storage ?? safeSession();
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

/**
 * Begin a session, or return the one already running.
 *
 * Deliberately NOT restarting an existing session: a visitor who opens the demo
 * in a second tab, or reloads, must not be handed a fresh 28 minutes. The
 * deadline is set once and every surface reads the same one.
 */
export function startSession(now: number, storage?: Pick<Storage, "getItem" | "setItem">): number {
  const store = storage ?? safeSession();
  const existing = readDeadline(store as Pick<Storage, "getItem"> | undefined);
  if (existing !== null && existing > now) return existing;
  const deadline = now + DEMO_SESSION_MS;
  try {
    store?.setItem(STORAGE_KEY, String(deadline));
  } catch {
    // Private browsing with storage denied. The session still runs for this
    // page's lifetime from the returned deadline; it simply will not survive a
    // reload, which is better than refusing to start the demo at all.
  }
  return deadline;
}

/** Clear the session. Used at expiry and when the visitor leaves deliberately. */
export function endSession(storage?: Pick<Storage, "removeItem">): void {
  const store = storage ?? safeSession();
  try {
    store?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up if storage is unavailable */
  }
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
 * `m:ss` under ten minutes and whole minutes above it. A demo badge counting
 * seconds for twenty-eight minutes is a pressure device; seconds only start
 * mattering near the end, which is exactly when they should appear.
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

function safeSession(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
