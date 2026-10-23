/**
 * The phone bubble's device-local state: where it sits, whether it is shown,
 * and the question it is handing to the JARVIS page. Kept apart from the
 * component so Settings and the JARVIS page can use it without the bubble.
 */
import { useSyncExternalStore } from "react";

/* --- the quick ask, handed to the JARVIS page in memory (never a link) ----- */

/** A question for the JARVIS page; `savedId` when the bubble already saved it. */
export interface HandedQuestion {
  text: string;
  savedId?: string;
  /** Put in JARVIS's box unsent (from Chat): the person still presses Send. */
  draftOnly?: boolean;
}
let pending: HandedQuestion | null = null;

/** Hand a question to the JARVIS page, which asks it once it is open. */
export function handOff(question: HandedQuestion): void {
  pending = question;
}
/** The question handed over by the bubble, taken once by the JARVIS page. */
export function takeHandOff(): HandedQuestion | null {
  const question = pending;
  pending = null;
  return question;
}

/* --- where the bubble sits and whether it is shown, per device ------------- */

export interface Placement {
  hidden: boolean;
  side: "left" | "right";
  /** Top edge as a fraction of the viewport height, so rotation keeps it in place. */
  y: number;
}
const KEY = "ocade:jarvis-bubble";
const DEFAULT: Placement = { hidden: false, side: "right", y: 0.62 };
const listeners = new Set<() => void>();
let cached: Placement | null = null;

function readPlacement(): Placement {
  if (cached) return cached;
  try {
    cached = { ...DEFAULT, ...JSON.parse(window.localStorage.getItem(KEY) ?? "{}") };
  } catch {
    cached = DEFAULT;
  }
  return cached!;
}

export function writePlacement(next: Partial<Placement>): void {
  cached = { ...readPlacement(), ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    /* Storage refused: the bubble still moves, it just forgets on reload. */
  }
  listeners.forEach((listener) => listener());
}

export function useBubblePlacement(): Placement {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readPlacement,
    () => DEFAULT,
  );
}
