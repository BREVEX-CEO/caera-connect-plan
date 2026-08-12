import { createContext, useContext } from "react";

/**
 * Demo mode state: the shape, the context and the accessor.
 *
 * WHAT THIS USED TO CARRY. A whole fictional company — invoices, timesheets,
 * tasks, files, a resume, a message thread — because the demo was four sample
 * products. Those products are gone and the demo now runs the real engine, so
 * the only thing left worth sharing is whether demo mode is on and how to leave
 * it. Sample data for screens that no longer exist is a maintenance cost with
 * no reader.
 */

export type DemoContextValue = {
  active: boolean;
  /** Clear the temporary session and start it again. */
  reset: () => void;
  /** Leave demo mode and return to the landing page. */
  exit: () => void;
};

export const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used inside DemoProvider (route under /demo/*).");
  return value;
}
