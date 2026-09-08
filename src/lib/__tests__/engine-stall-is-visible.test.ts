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

/**
 * Where one instruction is actually run.
 *
 * `send` is now a thin wrapper that holds the commercial permit and delegates;
 * the run itself, with the error handling these tests are about, lives in
 * `runMission`. Resolved once, and asserted to exist, because an anchor that
 * silently misses turns every assertion below it into a slice of the whole
 * file — which passes for the wrong reason.
 */
const RUN_ANCHOR = "const runMission = useCallback";
const RUN = MISSION.slice(MISSION.indexOf(RUN_ANCHOR));

/** Every `catch (cause) { … }` body in a stretch of source, brace-balanced. */
function catchBodies(source: string): string[] {
  const bodies: string[] = [];
  const opener = /catch \(cause\) \{/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (index < source.length && depth > 0) {
      const character = source[index];
      if (character === "{") depth += 1;
      else if (character === "}") depth -= 1;
      index += 1;
    }
    if (depth === 0) bodies.push(source.slice(start, index - 1));
  }
  return bodies;
}

describe("a failure mid-run is visible, not silent", () => {
  it("still knows where the run lives", () => {
    expect(MISSION).toContain(RUN_ANCHOR);
  });

  it("never writes a failure as ordinary transcript text without also raising the banner", () => {
    /*
     * THE ORIGINAL DEFECT, STATED EXACTLY. A failure mid-run wrote a
     * transcript line and set no error state, so a dead engine produced a
     * paragraph that read like an answer above a panel that looked idle.
     *
     * So the rule is not "every catch sets the banner" — the tool-execution
     * catch correctly turns a failure into a tool outcome the model can react
     * to, and raising a banner there would be wrong. The rule is: a catch that
     * SPEAKS TO THE PERSON must also look like a failure.
     *
     * TWO EARLIER VERSIONS OF THIS TEST PASSED WITH THE GUARANTEE DELETED.
     * The first read only the first catch in the function. The second read all
     * of them but bounded each body with `indexOf("} finally {")`, which runs
     * past the end of one catch and into the next — so a block with nothing in
     * it borrowed the assertion from a block further down. Both were caught by
     * deleting `setError` from the model path on purpose and watching the test
     * stay green. The bodies are brace-balanced now.
     */
    const catches = catchBodies(RUN);
    expect(catches.length, "the run has more than one way to fail").toBeGreaterThanOrEqual(3);

    const speaking = catches.filter((body) => body.includes('role: "ocade"'));
    expect(speaking.length, "some catch reports a failure to the person").toBeGreaterThanOrEqual(2);

    for (const [index, body] of speaking.entries()) {
      expect(body, `speaking catch #${index + 1} raises the banner`).toContain("setError(message)");
      expect(body, `speaking catch #${index + 1} holds the phase`).toContain('setPhase("error")');
    }
  });

  it("holds the error state instead of returning to idle", () => {
    expect(MISSION).toMatch(/current === "stopped" \|\| current === "error" \? current : "idle"/);
  });

  it("clears a stale error when a new instruction arrives", () => {
    // Otherwise the banner from one dead call sits above every later run.
    expect(RUN.slice(0, 1600)).toContain("setError(null)");
  });

  it("keeps 'error' out of the busy set, so the spinner stops", () => {
    const busy = MISSION.slice(MISSION.indexOf("const busy ="));
    expect(busy.slice(0, 160)).not.toContain('"error"');
  });
});
