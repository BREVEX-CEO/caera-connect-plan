import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * The bands drawn for real, on a canvas, in a browser.
 *
 * The shape is unit-tested as pure maths; this proves the drawing code puts it
 * on a canvas, that it travels, and that the pointer parallax reaches the
 * pixels. It runs the scene directly rather than through the app, because on a
 * low-performance machine the app correctly decides to hold still — which is
 * the right product behaviour and the wrong way to learn whether the layer
 * draws anything.
 */
const CHROMIUM = process.env.OCADE_BROWSER_PATH || "/opt/pw-browsers/chromium";

describe.runIf(existsSync(CHROMIUM))("the flow bands reach the canvas", () => {
  it("renders, travels over time, and follows the pointer", async () => {
    const { stdout } = await run(process.execPath, ["scripts/e2e/flow-wave-render.mjs"], {
      timeout: 240_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    expect(stdout).not.toMatch(/^FAIL /m);
    const summary = stdout.match(/(\d+)\/(\d+) flow-wave render checks passed/);
    expect(summary, `no summary in output:\n${stdout}`).not.toBeNull();
    expect(summary![1]).toBe(summary![2]);
    expect(Number(summary![2])).toBeGreaterThanOrEqual(5);
    expect(stdout).toMatch(/the bands move between two moments in time/);
    expect(stdout).toMatch(/moving the pointer changes what is drawn/);
  }, 260_000);
});
