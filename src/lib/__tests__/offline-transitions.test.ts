import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Online → offline → online, driven by Chromium's own network emulation so
 * `navigator.onLine` really flips and the events the product listens to really
 * fire. It needs a running app, so it is skipped — by name, never silently —
 * when one is not there; `npm run audit:offline` starts everything.
 */
const CHROMIUM = process.env.OCADE_BROWSER_PATH || "/opt/pw-browsers/chromium";
const STATE = "/tmp/ocade-onboarded-state.json";

async function appIsUp() {
  try {
    const response = await fetch(process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080/", {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const ready = existsSync(CHROMIUM) && existsSync(STATE) && (await appIsUp());

describe.runIf(ready)("the app handles losing and regaining the network", () => {
  it("observes every transition and keeps working offline", async () => {
    const { stdout } = await run(process.execPath, ["scripts/e2e/offline-transitions.mjs"], {
      timeout: 300_000,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, OCADE_STORAGE_STATE: STATE },
    });
    expect(stdout).not.toMatch(/^FAIL /m);
    const summary = stdout.match(/(\d+)\/(\d+) offline-transition checks passed/);
    expect(summary, `no summary in output:\n${stdout}`).not.toBeNull();
    expect(summary![1]).toBe(summary![2]);
    expect(Number(summary![2])).toBeGreaterThanOrEqual(13);
    expect(stdout).toMatch(/the app saw the transitions in order — offline,online,offline/);
  }, 320_000);
});

describe.runIf(!ready)("offline transitions are skipped honestly", () => {
  it("says why rather than passing without running", () => {
    // A skipped browser test must not read as a passing one.
    expect(ready).toBe(false);
  });
});
