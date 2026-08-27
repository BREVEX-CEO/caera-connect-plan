/**
 * Housekeeping must never cancel the person.
 *
 * Every ordinary send aborts whatever was in flight, which is correct when a
 * user types over their own half-finished request. Session-memory extraction
 * uses the same engine, and if it took the same path it could abort the message
 * somebody just pressed send on — a failure with no error, no log and no way to
 * tell it from the engine being slow.
 *
 * The guarantee is structural, so the check is too: this reads the two files
 * that have to agree and asserts the shape, rather than claiming to have
 * observed a race it cannot reproduce in a node test.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ENGINE = readFileSync(
  fileURLToPath(new URL("../use-local-chat-engine.ts", import.meta.url)),
  "utf8",
);
const RUNTIME = readFileSync(
  fileURLToPath(new URL("../../runtime/use-ocade-runtime.ts", import.meta.url)),
  "utf8",
);

/** The body of `send`, which is the only part these rules apply to. */
function sendBody(): string {
  const start = ENGINE.indexOf("const send = useCallback(");
  const end = ENGINE.indexOf("const stop = useCallback(", start);
  expect(start, "send should exist").toBeGreaterThan(-1);
  expect(end, "stop should follow send").toBeGreaterThan(start);
  return ENGINE.slice(start, end);
}

describe("a background send", () => {
  it("is an option the engine actually offers", () => {
    expect(ENGINE).toMatch(/background\?: boolean;/);
  });

  it("never writes the user's abort controller directly", () => {
    const body = sendBody();
    /*
     * Every assignment inside `send` has to go through `claim`, which routes to
     * the background ref when the send is background. A direct assignment is
     * the exact line that would let housekeeping take the user's controller.
     */
    expect(body).not.toMatch(/abortRef\.current\s*=\s*controller/);
    expect(body).not.toMatch(/abortRef\.current\s*=\s*null/);
    expect(body).toMatch(/if \(!background\) abortRef\.current\?\.abort\(\)/);
  });

  it("never reports engine status, so it cannot narrate itself on screen", () => {
    const body = sendBody();
    expect(body).not.toMatch(/[^.]\bapply\(/);
    expect(body).toMatch(/const report = background \? \(\) => \{\} : apply;/);
  });

  it("is ended by the next ordinary send, because the user wins", () => {
    const body = sendBody();
    expect(body).toMatch(/backgroundRef\.current\?\.abort\(\);/);
  });

  it("is what session-memory extraction uses", () => {
    const start = RUNTIME.indexOf("const learn = useCallback(");
    const end = RUNTIME.indexOf("Run a request that may need tools", start);
    expect(start).toBeGreaterThan(-1);
    expect(RUNTIME.slice(start, end)).toMatch(/background: true,/);
  });
});
