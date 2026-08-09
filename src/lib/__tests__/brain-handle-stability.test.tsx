import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A hook that returns callbacks must return a STABLE object.
 *
 * THE DEFECT THIS PINS. `useBrain` returned a fresh object literal every
 * render, with a fresh `remedyLabel` arrow inside it. Every consumer that put
 * the handle in a dependency array got a new identity on each render, so
 * `useCallback([brain])` produced a new callback, and an effect depending on
 * that callback re-ran, set state, and re-rendered.
 *
 * The demo chat screen probes the engine once on mount — `useEffect(() =>
 * check(), [check])` — which is the ordinary way to do it. It hit "Maximum
 * update depth exceeded" instantly and the error boundary tore the screen down.
 * The bug was in the hook, not in the screen, and it had been latent for as
 * long as nothing depended on the handle's identity.
 *
 * Checked as source structure rather than by rendering: React Testing Library
 * is not a dependency here, and the property that matters is exactly the one
 * visible in the code — the return value goes through `useMemo`, and every
 * function it exposes is a `useCallback`.
 */

const SOURCE = readFileSync("src/lib/brain/use-brain.ts", "utf8");
const ENGINE = readFileSync("src/lib/chat/use-local-chat-engine.ts", "utf8");

function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

describe("useBrain hands back a stable handle", () => {
  it("returns through useMemo, not a fresh object literal", () => {
    const body = code(SOURCE);
    expect(body).toMatch(/return useMemo\(/);
    // The shape that caused the loop: `return {` with the fields inline.
    expect(body).not.toMatch(/return \{\s*mode: effectiveMode/);
  });

  it("memoises every function it exposes", () => {
    const body = code(SOURCE);
    for (const fn of ["route", "warm", "remedyLabel"]) {
      expect(body, `${fn} is not a useCallback`).toMatch(
        new RegExp(`const ${fn} = useCallback\\(`),
      );
    }
    // An inline arrow in the returned object is a new identity every render,
    // which is precisely what `remedyLabel` used to be.
    expect(body).not.toMatch(/remedyLabel: \(remedy\) =>/);
  });

  it("lists the memo dependencies rather than leaving them empty", () => {
    // An empty dependency array would be stable and WRONG: switching device
    // mode has to produce a new handle, or the screen keeps routing to the
    // engine it resolved on first render.
    const memo = /return useMemo\([\s\S]*?\[([^\]]*)\]/.exec(code(SOURCE));
    expect(memo).not.toBeNull();
    expect(memo![1]).toContain("effectiveMode");
    expect(memo![1]).toContain("route");
  });
});

describe("the shared chat engine keeps its own callbacks stable", () => {
  it("wraps every exposed function in useCallback", () => {
    const body = code(ENGINE);
    for (const fn of ["apply", "check", "send", "stop"]) {
      expect(body, `${fn} is not a useCallback`).toMatch(
        new RegExp(`const ${fn} = useCallback\\(`),
      );
    }
  });

  it("guards state updates that land after unmount", () => {
    /*
     * The demo can expire mid-request, and a probe resolving into an unmounted
     * component is a warning at best and a leak at worst. Every setState after
     * an await goes through `apply`, which checks the live ref first.
     */
    const body = code(ENGINE);
    expect(body).toMatch(/liveRef/);
    expect(body).toMatch(/if \(!liveRef\.current\) return/);
  });

  it("aborts any running generation when it unmounts", () => {
    expect(code(ENGINE)).toMatch(/abortRef\.current\?\.abort\(\)/);
  });
});
