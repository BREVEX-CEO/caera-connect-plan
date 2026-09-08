import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * What the browser engines say about themselves, checked in a real browser.
 *
 * The property under test is HONESTY, which is the only part that can be
 * settled without weights: an engine that cannot run has to say so, with a
 * code and a reason, rather than reporting itself available and failing after
 * a several-hundred-megabyte download.
 */
const CHROMIUM = process.env.OCADE_BROWSER_PATH || "/opt/pw-browsers/chromium";

describe.runIf(existsSync(CHROMIUM))("the on-device engines report themselves honestly", () => {
  it("distinguishes the WebGPU API from a usable adapter, and falls back to WASM", async () => {
    const { stdout } = await run(process.execPath, ["scripts/e2e/engine-availability.mjs"], {
      timeout: 240_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    expect(stdout).not.toMatch(/^FAIL /m);
    const summary = stdout.match(/(\d+)\/(\d+) engine-availability checks passed/);
    expect(summary, `no summary in output:\n${stdout}`).not.toBeNull();
    expect(summary![1]).toBe(summary![2]);
    // A usable WebGPU adapter needs five checks; the unavailable branch adds
    // two diagnostics (reason and code). Count the exercised branch rather
    // than assuming headless Chrome has no GPU on every machine.
    expect(Number(summary![2])).toBeGreaterThanOrEqual(5);
    // An engine that cannot run must never come back "available".
    expect(stdout).toMatch(/environment: navigator\.gpu=/);
  }, 260_000);
});
