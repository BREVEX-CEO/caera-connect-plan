/**
 * JARVIS ACTION CHANGES AS EVENTS (PLAN.md section E).
 *
 * One Realtime subscription per tab to this account's `jarvis_activity` rows
 * (row-level security limits it to the account). An event only says "look now":
 * every consumer still reads through its server function, so nothing is decided
 * from the event itself, and a timer remains as the fail-safe for a lost socket.
 */
import { useEffect, useState } from "react";

type Listener = (id: string) => void;
const listeners = new Set<Listener>();
let channel: Promise<{ unsubscribe: () => unknown }> | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;
let subscribed = false;
const status = new Set<(live: boolean) => void>();

function open(): void {
  clearTimeout(idle);
  channel ??= import("@/integrations/supabase/client").then(({ supabase }) =>
    supabase
      .channel("jarvis-actions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jarvis_activity" },
        (change) => {
          // Live means events really arrive: a joined socket on a database whose
          // publication lacks the table would otherwise slow every wait down.
          if (!subscribed) {
            subscribed = true;
            for (const tell of status) tell(true);
          }
          const id = ((change.new ?? change.old) as { id?: string }).id ?? "";
          for (const listener of [...listeners]) listener(id);
        },
      )
      .subscribe((state) => {
        if (state === "SUBSCRIBED") return; // proven by the first event, not by joining
        subscribed = false;
        for (const tell of status) tell(false);
      }),
  );
}

function closeWhenUnused(): void {
  if (listeners.size > 0) return;
  idle = setTimeout(() => {
    void channel?.then((live) => live.unsubscribe());
    channel = null;
    subscribed = false;
    for (const tell of status) tell(false);
  }, 60_000);
}

/** Listen for changes; returns the way to stop listening. */
export function onActionChange(listener: Listener): () => void {
  open();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    closeWhenUnused();
  };
}

/** Rows that changed while nobody waited on them (mid-read), so the next wait returns at once. */
const changedSince = new Set<string>();
const watched = new Set<string>();
const waiters = new Map<string, Set<() => void>>();
let stopWatching: (() => void) | null = null;

/** Resolves when action `id` changes, or after `ms` at the latest. */
export function actionChanged(id: string, ms: number): Promise<void> {
  stopWatching ??= onActionChange((changed) => {
    const set = waiters.get(changed);
    if (set?.size) for (const wake of [...set]) wake();
    else if (watched.has(changed)) changedSince.add(changed);
  });
  if (!watched.has(id)) {
    if (watched.size > 200) watched.clear(); // ponytail: bounded by clearing, not LRU
    watched.add(id);
  }
  if (changedSince.delete(id)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const set = waiters.get(id) ?? new Set();
    waiters.set(id, set);
    const done = () => {
      clearTimeout(timer);
      set.delete(done);
      if (set.size === 0) waiters.delete(id);
      if (waiters.size === 0) {
        stopWatching?.();
        stopWatching = null;
      }
      resolve();
    };
    // Without a live socket the old poll cadence returns, so nothing waits longer.
    const timer = setTimeout(done, subscribed ? ms : Math.min(ms, 400));
    set.add(done);
  });
}

/**
 * Calls `refresh` on every action change while mounted; true while the socket is
 * live, so a caller can relax its fail-safe refresh interval.
 */
export function useActionChanges(refresh: () => void, enabled = true): boolean {
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const stop = onActionChange(() => refresh());
    status.add(setLive);
    setLive(subscribed);
    return () => {
      status.delete(setLive);
      stop();
    };
  }, [refresh, enabled]);
  return live;
}
