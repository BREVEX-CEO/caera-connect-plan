import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DemoContext, type DemoContextValue } from "./use-demo";
import { endSession } from "./session";

const DEMO_FLAG_KEY = "caera:demo";

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(DEMO_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFlag(active: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (active) window.sessionStorage.setItem(DEMO_FLAG_KEY, "1");
    else window.sessionStorage.removeItem(DEMO_FLAG_KEY);
  } catch {
    /* Private browsing with storage denied. Demo mode still works for this page. */
  }
}

/**
 * Marks the browser as being in demo mode, and owns the way out.
 *
 * WHAT THIS NO LONGER HOLDS: a fictional company's invoices, timesheets, tasks,
 * files and message threads. Those belonged to demo screens for products that
 * have been removed, and to a chat that answered from a fixed string.
 *
 * The conversation is deliberately NOT here either. It lives in the demo
 * route's own state, because a demo conversation that survived a provider
 * re-render — or a trip to settings and back — would outlive the 28-minute
 * session it belongs to. Temporary has to mean temporary.
 */
export function DemoProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);

  /*
   * Read after mount rather than during render. `sessionStorage` does not exist
   * on the server, and seeding state from it during render makes the first
   * client render disagree with the server's markup.
   */
  useEffect(() => {
    writeFlag(true);
    setActive(true);
  }, []);

  const exit = useCallback(() => {
    endSession();
    writeFlag(false);
    setActive(false);
    void navigate({ to: "/", replace: true });
  }, [navigate]);

  const reset = useCallback(() => {
    // Reloading drops the route-owned temporary conversation while preserving
    // the same absolute deadline. Clearing it here would make a harmless
    // "reset conversation" action consume the entire once-per-28-hours demo.
    if (typeof window !== "undefined") window.location.assign("/demo/ocade");
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({ active: active || readFlag(), reset, exit }),
    [active, reset, exit],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
