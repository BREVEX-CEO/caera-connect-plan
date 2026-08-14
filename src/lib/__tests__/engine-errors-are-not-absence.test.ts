import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * "WhatsApp control needs the control engine" — while the engine was running.
 *
 * THE LIVE REPORT THIS EXISTS TO PREVENT.
 * ----------------------------------------
 * OCADE opened WhatsApp. OCADE found the group "H" and opened the chat. Then
 * typing failed with "WhatsApp control needs the control engine" — a sentence
 * that cannot have been true, because the engine had just done two things.
 *
 * The cause was one condition in `viaEngine`. The Python bridge wraps any
 * uncaught handler exception as `retryable_failure` CARRYING THE REAL REASON.
 * `viaEngine` treated that identically to "the engine could not be started",
 * returned null, and every caller's `if (!reply)` branch then announced the
 * engine was missing. The true diagnosis was thrown away and replaced with a
 * false one — for all twenty-three tools that go through that function.
 *
 * These are source assertions rather than behavioural ones because the failure
 * is the ABSENCE of a distinction: reproducing it needs a live engine host
 * that fails in a specific way, and the thing actually worth guarding is that
 * nobody re-adds the collapse.
 */
const ADAPTERS = readFileSync("src/lib/agent/adapters.node.ts", "utf8");

function viaEngineBody(): string {
  const start = ADAPTERS.indexOf("private async viaEngine");
  expect(start, "viaEngine should exist").toBeGreaterThan(-1);
  return ADAPTERS.slice(start, ADAPTERS.indexOf("\n  }", start));
}

describe("an engine that failed is not an engine that is missing", () => {
  it("does not collapse a handler failure into 'no engine'", () => {
    /*
     * The whole bug in one line. `retryable_failure` means the bridge RAN the
     * handler and it raised, so the reply carries a real sentence about what
     * went wrong — which must reach the user instead of being discarded.
     */
    expect(viaEngineBody()).not.toContain('reply.code === "retryable_failure"');
  });

  it("still treats a failed spawn as a missing engine", () => {
    // `unsupported` IS what the transport returns when the process cannot be
    // started at all — see native-host-client.node.ts. There the "needs the
    // control engine" message is the truth, so that collapse stays.
    expect(viaEngineBody()).toContain('reply.code === "unsupported"');
  });

  it("passes a failed reply back so the caller can read its reason", () => {
    // Not null. The caller's `if (!reply.ok) return outcomeFor(reply, …)` is
    // what surfaces the engine's own sentence.
    expect(viaEngineBody()).toContain("return reply;");
  });
});

describe("every tool reaches a real host", () => {
  /*
   * The other half of the report was a suspicion that some adapters were mock
   * stubs. They are not — every one dispatches to the engine, the browser host
   * or the Python host — and this keeps it that way, because a hand-written
   * "not implemented" return is exactly what a stub looks like.
   */
  it("no adapter method returns a hardcoded success", () => {
    // A fabricated success is the only truly dangerous stub: a fabricated
    // failure is merely unhelpful, but a fabricated success is a lie in a
    // receipt. `ok(` with no host call above it in the same method is the
    // shape to catch.
    const methods = [...ADAPTERS.matchAll(/private async (\w+)\([^)]*\)[^{]*\{/g)];
    expect(methods.length).toBeGreaterThan(50);

    const fabricated: string[] = [];
    for (const match of methods) {
      const from = match.index ?? 0;
      const body = ADAPTERS.slice(from, ADAPTERS.indexOf("\n  }", from));
      const dispatches =
        /viaEngine|viaBrowser|viaPython|engineHost\(\)|browserHost\(\)|pythonHost\(\)|this\.\w+\(/.test(
          body,
        );
      if (!dispatches && /\breturn ok\(/.test(body)) fabricated.push(match[1]);
    }
    expect(fabricated, `these return success without calling anything: ${fabricated}`).toEqual([]);
  });
});
