import { useSyncExternalStore } from "react";

/**
 * Whether this browser currently has a network at all.
 *
 * `navigator.onLine` with its own events, through the subscription primitive
 * React already provides — no polling, no state to keep in sync, and correct
 * during hydration because the server snapshot says online. It answers "is
 * there a network", not "is OCADE reachable"; the router still probes the
 * boundary before routing anywhere.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("online", notify);
      window.addEventListener("offline", notify);
      return () => {
        window.removeEventListener("online", notify);
        window.removeEventListener("offline", notify);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
