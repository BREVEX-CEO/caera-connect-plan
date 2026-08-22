import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * The six prompts, through the shipped pipeline, with their timings recorded.
 *
 * Every prompt has ground truth that exists before the engine answers. The
 * timings are pipeline latency, not inference latency — the script says so in
 * its own output, because no weights are reachable from this sandbox.
 */
describe("six prompts go through the real chat pipeline", () => {
  it("answers all six correctly and records what it measured", async () => {
    const { stdout } = await run("npx", ["vite-node", "scripts/e2e/chat-six-prompts.mjs"], {
      timeout: 300_000,
      maxBuffer: 8 * 1024 * 1024,
    });

    const summary = stdout.match(/(\d+)\/(\d+) prompts answered correctly/);
    expect(summary, `no summary in output:\n${stdout}`).not.toBeNull();
    expect(summary![1]).toBe(summary![2]);
    expect(Number(summary![2])).toBe(6);

    // Each category actually ran, rather than six variants of one prompt.
    for (const category of [
      "factual",
      "reasoning",
      "multi-turn",
      "long",
      "current information",
      "offline",
    ]) {
      expect(stdout, `${category} prompt missing`).toContain(category);
    }

    // The offline prompt must have CONFIRMED it was offline, not assumed it.
    expect(stdout).toMatch(/verified offline: no public host reachable/);

    // The timings must not be presented as inference figures.
    expect(stdout).toMatch(/timings are PIPELINE latency, not inference latency/);
  }, 320_000);
});
