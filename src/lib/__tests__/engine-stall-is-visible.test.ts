import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The reported hang: Notepad opened, then the panel sat on "Thinking" forever.
 *
 * Two things had to both be true for that to be possible, and each is asserted
 * here because each is one deleted line away from coming back.
 *
 *   1. The model call carried no deadline of its own — only the user's Stop
 *      button. An engine that accepts the socket and never answers is then
 *      indistinguishable from an engine thinking hard, and the fetch waits
 *      forever.
 *   2. A failure mid-run set no error state, so even when something DID throw,
 *      the panel rendered it as ordinary transcript text and looked idle.
 *
 * These read source rather than executing the hook because the failure is
 * structural — the absence of a timeout cannot be observed by a test that
 * waits for one.
 */
const BRIDGE = readFileSync("src/lib/brain/adapters/desktop-bridge.ts", "utf8");
const MISSION = readFileSync("src/lib/work/use-mission.ts", "utf8");

describe("a stalled engine cannot hang the panel", () => {
  it("bounds the wait for a first token", () => {
    expect(BRIDGE).toMatch(/FIRST_TOKEN_TIMEOUT_MS\s*=\s*[\d_]+/);
  });

  it("bounds the gap between tokens once a stream has started", () => {
    expect(BRIDGE).toMatch(/BETWEEN_TOKEN_TIMEOUT_MS\s*=\s*[\d_]+/);
  });

  it("re-arms the deadline on every token, so a long reply is never cut off", () => {
    // Without this a 400-word essay that is streaming perfectly well would be
    // aborted at the deadline. Progress, not elapsed time, is the test.
    const onToken = BRIDGE.slice(BRIDGE.indexOf("onToken: (chunk)"));
    expect(onToken).toContain("arm(BETWEEN_TOKEN_TIMEOUT_MS");
  });

  it("combines the stall deadline with the user's Stop rather than replacing it", () => {
    // Dropping handlers.signal here would break the Stop button, which is a
    // worse bug than the one being fixed.
    expect(BRIDGE).toContain("AbortSignal.any([handlers.signal, stall.signal])");
  });

  it("reports a stall as an error, never as a cancellation", () => {
    // "Stopped." blames the user for an engine that died. The UI shows
    // `error` in red and `cancelled` quietly, so this is the difference
    // between a visible fault and a silent one.
    const stall = BRIDGE.slice(BRIDGE.indexOf("if (stalledAt !== null)"));
    expect(stall).toContain('failure: "error"');
    expect(stall.slice(0, 600)).not.toContain('failure: "cancelled"');
  });
});

describe("a failure mid-run is visible, not silent", () => {
  it("sets the error banner as well as writing a transcript line", () => {
    // Anchored inside send(), not connect() — both have a `catch (cause)`, and
    // connect()'s already set an error, which is what made the run-time one
    // easy to miss.
    const send = MISSION.slice(MISSION.indexOf("const send = useCallback"));
    const caught = send.slice(send.indexOf("} catch (cause) {"));
    const block = caught.slice(0, caught.indexOf("} finally {"));
    expect(block).toContain("setError(message)");
    expect(block).toContain('setPhase("error")');
  });

  it("holds the error state instead of returning to idle", () => {
    expect(MISSION).toMatch(
      /current === "stopped" \|\| current === "error" \? current : "idle"/,
    );
  });

  it("clears a stale error when a new instruction arrives", () => {
    // Otherwise the banner from one dead call sits above every later run.
    const send = MISSION.slice(MISSION.indexOf("const send = useCallback"));
    expect(send.slice(0, 1200)).toContain("setError(null)");
  });

  it("keeps 'error' out of the busy set, so the spinner stops", () => {
    const busy = MISSION.slice(MISSION.indexOf("const busy ="));
    expect(busy.slice(0, 160)).not.toContain('"error"');
  });
});
