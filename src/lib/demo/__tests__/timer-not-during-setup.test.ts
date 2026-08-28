import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEMO_SESSION_MS,
  readDeadline,
  sessionState,
  startSession,
  endSession,
} from "../session";

/**
 * THE 28 MINUTES BELONG TO THE USER, NOT TO THE SETUP.
 *
 * THE DEFECT. `demo.ocade.tsx` passed `autoStart: true` literally, so the
 * deadline was written into storage the instant the route mounted — while the
 * engine was still being prepared. On a slow connection a visitor spent a
 * large part of their session watching a progress bar, and because the deadline
 * is absolute wall-clock time (deliberately, so that closing a laptop cannot
 * buy free minutes) those minutes could not be handed back afterwards.
 *
 * THE FIX THAT WOULD HAVE BEEN A LIE. Freezing the displayed countdown while an
 * absolute deadline ticks underneath. The clock would read 28:00 throughout
 * setup and then jump. These tests exist partly to make that shortcut fail:
 * the assertion is about what is IN STORAGE, not about what is rendered.
 *
 * THE FIX. No session exists during setup. `autoStart` is now the readiness of
 * the installation authority, so `startSession` is not called at all until the
 * engine has proven itself — and the first call writes `now + 28 minutes`.
 */

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    has: (k: string) => map.has(k),
  };
}

let store: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  store = memoryStorage();
});

describe("no deadline exists while OCADE is being prepared", () => {
  it("writes nothing at all when the session is not started", () => {
    // This is the whole property: setup must leave storage untouched.
    expect(readDeadline(store)).toBeNull();
    expect(store.has("caera:demo:session:v2")).toBe(false);
  });

  it("gives the FULL 28 minutes when setup took twenty minutes", () => {
    const arrived = 1_000_000;
    const twentyMinutes = 20 * 60 * 1000;
    const readyAt = arrived + twentyMinutes;

    // Nothing was started while setup ran, however long it ran for.
    expect(readDeadline(store)).toBeNull();

    const deadline = startSession(readyAt, store);
    expect(deadline).toBe(readyAt + DEMO_SESSION_MS);

    // And at the moment the demo opens, the clock reads exactly 28:00.
    const state = sessionState(deadline, readyAt);
    expect(state.remainingMs).toBe(DEMO_SESSION_MS);
    expect(state.elapsedFraction).toBe(0);
    expect(state.phase).toBe("active");
  });

  it("gives the SAME full 28 minutes when setup took two seconds", () => {
    const readyAt = 1_000_000 + 2_000;
    const deadline = startSession(readyAt, store);
    expect(sessionState(deadline, readyAt).remainingMs).toBe(DEMO_SESSION_MS);
  });

  it("is measured from readiness, not from arrival", () => {
    const arrived = 5_000_000;
    const readyAt = arrived + 12 * 60 * 1000;
    const deadline = startSession(readyAt, store)!;
    // The distinction the old code got wrong: the deadline must be anchored to
    // the moment the engine became usable.
    expect(deadline - readyAt).toBe(DEMO_SESSION_MS);
    expect(deadline - arrived).toBeGreaterThan(DEMO_SESSION_MS);
  });

  it("does not hand out a second 28 minutes on a reload", () => {
    const readyAt = 2_000_000;
    const first = startSession(readyAt, store);
    // A reload two minutes in re-enters the same session, not a fresh one.
    const second = startSession(readyAt + 120_000, store);
    expect(second).toBe(first);
    expect(sessionState(second, readyAt + 120_000).remainingMs).toBe(DEMO_SESSION_MS - 120_000);
  });

  it("counts down normally once it has begun", () => {
    const readyAt = 3_000_000;
    const deadline = startSession(readyAt, store);
    expect(sessionState(deadline, readyAt + 60_000).remainingMs).toBe(DEMO_SESSION_MS - 60_000);
    expect(sessionState(deadline, readyAt + DEMO_SESSION_MS).phase).toBe("expired");
  });

  it("leaves nothing behind when the session ends", () => {
    startSession(4_000_000, store);
    endSession(store);
    expect(readDeadline(store)).toBeNull();
  });
});

describe("the wiring that makes it true", () => {
  const ROUTE = readFileSync("src/routes/demo.ocade.tsx", "utf8");
  const HOOK = readFileSync("src/lib/demo/use-demo-session.ts", "utf8");

  const withoutComments = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  it("no longer starts the clock unconditionally on mount", () => {
    // The exact line that caused it: `autoStart: true` as a literal.
    expect(withoutComments(ROUTE)).not.toMatch(/autoStart:\s*true/);
  });

  it("starts the clock from the installation's readiness", () => {
    expect(withoutComments(ROUTE)).toMatch(/autoStart:\s*installation\.ready/);
  });

  it("shows a setup screen rather than a chat with a dead composer", () => {
    const body = withoutComments(ROUTE);
    expect(body).toMatch(/<SetupExperience/);
    expect(body).toMatch(/if \(!installation\.ready && installation\.preparing\)/);
  });

  it("still derives the deadline from a wall clock, so sleeping cannot be gamed", () => {
    // The fix must not have quietly turned the deadline into a tickable
    // counter: a background tab throttles timers, and a counter would come back
    // showing time the user never spent.
    expect(HOOK).toMatch(/observeNow\(Date\.now\(\)\)/);
    expect(withoutComments(HOOK)).not.toMatch(/remainingMs\s*-=/);
  });
});
