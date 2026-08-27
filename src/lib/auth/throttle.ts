/**
 * How long OCADE makes someone wait after a failed attempt.
 *
 * WHAT WAS THERE BEFORE. A counter. The verify screen incremented `attempts`
 * and, from the fifth failure onward, showed a longer sentence — and then let
 * the sixth attempt go through immediately, and the seventh, at whatever rate
 * the person could type. The message said OCADE "stops guessing"; nothing
 * stopped. A script working through six-digit codes was slowed by exactly the
 * time it took to render a different string.
 *
 * WHAT THIS IS NOT. It is not the security boundary. The provider enforces its
 * own limits and is the thing that actually protects the account; a browser can
 * always clear its own storage. This is the layer that keeps an ordinary
 * mistyped code from becoming a provider lockout, and that makes an automated
 * attempt expensive enough to be worth someone's attention. Both are real, and
 * neither is a substitute for the server.
 *
 * THE SHAPE OF THE BACKOFF. Doubling from one second, capped at five minutes.
 * The first two failures cost a second or two — which is what a typo costs, and
 * a person who fat-fingered a digit should not be punished for it — and the
 * tenth costs five minutes, which is what a script cannot afford.
 */

export type ThrottledAction =
  "otp_verify" | "otp_send" | "password_signin" | "password_reset" | "signup";

export interface ThrottleState {
  /** Consecutive failures. Reset to zero by a success. */
  failures: number;
  /** When the most recent failure was recorded, in epoch milliseconds. */
  lastFailureAt: number;
}

/** Failures that pass without any wait, so an ordinary typo costs nothing. */
const FREE_ATTEMPTS = 2;

const FIRST_DELAY_SECONDS = 1;
const MAX_DELAY_SECONDS = 300;

export function emptyThrottle(): ThrottleState {
  return { failures: 0, lastFailureAt: 0 };
}

/**
 * The wait a given number of failures earns.
 *
 * Exported because the UI needs to explain the wait BEFORE it starts — "try
 * again in 4 seconds" is information; a button that silently does nothing is a
 * bug as far as the person pressing it is concerned.
 */
export function delayAfter(failures: number): number {
  if (failures <= FREE_ATTEMPTS) return 0;
  const doublings = failures - FREE_ATTEMPTS - 1;
  return Math.min(MAX_DELAY_SECONDS, FIRST_DELAY_SECONDS * 2 ** doublings);
}

/**
 * Seconds still to wait, or 0 when an attempt is allowed.
 *
 * A `lastFailureAt` in the future — a clock that moved backwards, a tab
 * restored from a suspended session — is treated as "the full wait remains"
 * rather than trusted, so a bad timestamp can never grant free attempts. It
 * also cannot lock anyone out for longer than the cap.
 */
export function secondsUntilAllowed(state: ThrottleState, now: number): number {
  const required = delayAfter(state.failures);
  if (required === 0) return 0;
  const elapsed = (now - state.lastFailureAt) / 1000;
  if (!Number.isFinite(elapsed) || elapsed < 0) return required;
  return Math.max(0, Math.ceil(required - elapsed));
}

export function recordFailure(state: ThrottleState, now: number): ThrottleState {
  return { failures: state.failures + 1, lastFailureAt: now };
}

/** A success clears the history: the person proved they are who they said. */
export function recordSuccess(): ThrottleState {
  return emptyThrottle();
}

/**
 * What to tell someone who has to wait.
 *
 * Never says how many attempts remain, and never distinguishes "wrong code"
 * from "no such account" — the gap between those two sentences is exactly what
 * somebody working through a list of addresses is trying to measure.
 */
export function describeWait(seconds: number): string {
  if (seconds <= 0) return "";
  if (seconds === 1) return "Try again in 1 second.";
  if (seconds < 60) return `Try again in ${seconds} seconds.`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "Try again in about a minute." : `Try again in about ${minutes} minutes.`;
}

/**
 * Per-action, per-identifier storage.
 *
 * Keyed by the identifier so that one person's failed attempts on their work
 * address do not lock them out of their personal one on the same machine. The
 * identifier is hashed rather than stored: a shared or borrowed computer should
 * not carry a readable list of the addresses somebody tried to sign in with.
 */
export function throttleKey(action: ThrottledAction, identifier: string): string {
  let hash = 0;
  const normalised = identifier.trim().toLowerCase();
  for (let i = 0; i < normalised.length; i++) {
    hash = ((hash << 5) - hash + normalised.charCodeAt(i)) | 0;
  }
  return `ocade:throttle:${action}:${(hash >>> 0).toString(36)}`;
}

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadThrottle(action: ThrottledAction, identifier: string): ThrottleState {
  const store = storage();
  if (!store) return emptyThrottle();
  try {
    const raw = store.getItem(throttleKey(action, identifier));
    if (!raw) return emptyThrottle();
    const parsed = JSON.parse(raw) as Partial<ThrottleState>;
    const failures =
      typeof parsed.failures === "number" && Number.isFinite(parsed.failures) && parsed.failures > 0
        ? Math.min(64, Math.floor(parsed.failures))
        : 0;
    const lastFailureAt =
      typeof parsed.lastFailureAt === "number" && Number.isFinite(parsed.lastFailureAt)
        ? parsed.lastFailureAt
        : 0;
    return { failures, lastFailureAt };
  } catch {
    return emptyThrottle();
  }
}

export function saveThrottle(
  action: ThrottledAction,
  identifier: string,
  state: ThrottleState,
): void {
  const store = storage();
  if (!store) return;
  try {
    if (state.failures === 0) {
      store.removeItem(throttleKey(action, identifier));
      return;
    }
    store.setItem(throttleKey(action, identifier), JSON.stringify(state));
  } catch {
    /* A blocked or full store must not stop somebody signing in. */
  }
}
