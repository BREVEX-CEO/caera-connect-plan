/**
 * Whether the phone JARVIS bubble is on screen. Kept tiny and in the root, so a
 * desktop or signed-out first visit never downloads the bubble; a signed-in
 * phone loads it after the page is up.
 */
import { useRouterState } from "@tanstack/react-router";
import { lazy, Suspense, useSyncExternalStore } from "react";
import { useSession } from "@/lib/session";
import { useBubblePlacement } from "./bubble-state";

const Bubble = lazy(() => import("./JarvisBubble").then((module) => ({ default: module.Bubble })));

function usePhoneWidth(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia("(max-width: 767px)");
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}

// The console is not a customer screen, on either origin.
const HIDDEN_ON = /^\/(ocade-jarvis|auth|reset-password|admin)/;

export function JarvisBubble() {
  const { user } = useSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const phone = usePhoneWidth();
  const placement = useBubblePlacement();
  const shown = Boolean(user) && phone && !placement.hidden && !HIDDEN_ON.test(pathname);
  if (!shown) return null;
  // Keyed by account: another account never sees this one's mini chat.
  return (
    <Suspense fallback={null}>
      <Bubble key={user!.id} placement={placement} />
    </Suspense>
  );
}
