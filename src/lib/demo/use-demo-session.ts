import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEMO_WARNING_MS,
  endSession,
  readDeadline,
  readNextEligibleAt,
  sessionState,
  startSession,
  observeNow,
  type DemoSessionState,
} from "./session";

/**
 * Runs the demo clock and fires the end of the session exactly once.
 *
 * TICK RATE. Once a second while the warning is showing, once every fifteen
 * otherwise. The badge displays whole minutes above ten minutes remaining, so
 * a per-second re-render for most of the 28 minutes would
 * repaint the tree for a string that did not change.
 *
 * EXPIRY FIRES ONCE. `onExpire` stops generation, clears the temporary
 * conversation and navigates away, and every one of those is unsafe to run
 * twice. A background tab can deliver several ticks in a burst when it is
 * refocused, so the guard is a ref rather than state — state would not have
 * settled before the second tick arrived.
 */
export function useDemoSession(options: {
  /** Start the clock. False on pages that only display it. */
  autoStart: boolean;
  onWarn?: (session: DemoSessionState) => void;
  onExpire?: () => void;
  onBlocked?: (nextEligibleAt: number | null) => void;
}): { session: DemoSessionState; blockedUntil: number | null; end: () => void } {
  const { autoStart, onWarn, onExpire, onBlocked } = options;
  const [session, setSession] = useState<DemoSessionState>(() =>
    sessionState(typeof window === "undefined" ? null : readDeadline(), observeNow(Date.now())),
  );
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const warnedRef = useRef(false);
  const expiredRef = useRef(false);
  // Held in refs so changing a handler does not restart the interval, which
  // would reset the tick phase on every parent render.
  const warnRef = useRef(onWarn);
  const expireRef = useRef(onExpire);
  const blockedRef = useRef(onBlocked);
  warnRef.current = onWarn;
  expireRef.current = onExpire;
  blockedRef.current = onBlocked;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const deadline = autoStart ? startSession(observeNow(Date.now())) : readDeadline();
    if (deadline === null) {
      setSession(sessionState(null, observeNow(Date.now())));
      const nextEligibleAt = readNextEligibleAt();
      setBlockedUntil(nextEligibleAt);
      if (autoStart) blockedRef.current?.(nextEligibleAt);
      return;
    }
    setBlockedUntil(null);

    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const next = sessionState(deadline, observeNow(Date.now()));
      setSession(next);

      if (next.phase === "ending" && !warnedRef.current) {
        warnedRef.current = true;
        warnRef.current?.(next);
      }

      if (next.phase === "expired") {
        if (!expiredRef.current) {
          expiredRef.current = true;
          endSession();
          expireRef.current?.();
        }
        return; // stop scheduling: the session is over
      }

      timer = setTimeout(tick, next.remainingMs <= DEMO_WARNING_MS ? 1000 : 15_000);
    };

    tick();
    return () => clearTimeout(timer);
  }, [autoStart]);

  /** Leave deliberately. Same cleanup as expiry, without the warning. */
  const end = useCallback(() => {
    expiredRef.current = true;
    endSession();
    setSession(sessionState(null, observeNow(Date.now())));
  }, []);

  return { session, blockedUntil, end };
}
