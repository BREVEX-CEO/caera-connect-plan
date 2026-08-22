import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { modelOwnerSupported } from "../local/model-owner";

const run = promisify(execFile);

/**
 * One model, one tab, however many tabs are open.
 *
 * The coordination cannot be tested in jsdom: `navigator.locks` is the whole
 * mechanism and jsdom does not implement it. So the real assertions run in a
 * real browser, three real tabs, through `scripts/e2e/model-owner-tabs.mjs`,
 * and this file runs that and holds it to its own summary.
 */

describe("the model owner reports honestly about what it can do", () => {
  it("says it is unsupported where the APIs are missing", () => {
    // jsdom has neither Web Locks nor BroadcastChannel wired for this.
    expect(modelOwnerSupported()).toBe(
      typeof BroadcastChannel === "function" &&
        typeof navigator !== "undefined" &&
        typeof navigator.locks?.request === "function",
    );
  });
});

const CHROMIUM = process.env.OCADE_BROWSER_PATH || "/opt/pw-browsers/chromium";

describe.runIf(existsSync(CHROMIUM))("three tabs share one model", () => {
  it("elects one owner, loads once, and fails over when the owner closes", async () => {
    const { stdout } = await run(process.execPath, ["scripts/e2e/model-owner-tabs.mjs"], {
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    expect(stdout).not.toMatch(/^FAIL /m);
    const summary = stdout.match(/(\d+)\/(\d+) model-owner checks passed/);
    expect(summary, `no summary in output:\n${stdout}`).not.toBeNull();
    expect(summary![1]).toBe(summary![2]);
    expect(Number(summary![2])).toBeGreaterThanOrEqual(8);
    // The number the whole thing exists for.
    expect(stdout).toMatch(/loaded exactly once across all three tabs/);
    expect(stdout).toMatch(/loads per tab: \[1, 0, 0\]/);
  }, 200_000);
});
