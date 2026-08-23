import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const run = promisify(execFile);

/**
 * The prompts, through the shipped pipeline, with their timings recorded.
 *
 * Every prompt has ground truth that exists before the engine answers. The
 * timings are pipeline latency, not inference latency — the script says so in
 * its own output, because no weights are reachable from this sandbox.
 */
describe("the chat prompts go through the real chat pipeline", () => {
  it("answers all of them correctly and records what it measured", async () => {
    const viteNode = join(process.cwd(), "node_modules", "vite-node", "vite-node.mjs");
    const { stdout } = await run(process.execPath, [viteNode, "scripts/e2e/chat-six-prompts.mjs"], {
      timeout: 300_000,
      maxBuffer: 8 * 1024 * 1024,
    });

    const summary = stdout.match(/(\d+)\/(\d+) prompts answered correctly/);
    expect(summary, `no summary in output:\n${stdout}`).not.toBeNull();
    expect(summary![1]).toBe(summary![2]);
    expect(Number(summary![2])).toBe(7);

    // Each category actually ran, rather than six variants of one prompt.
    for (const category of [
      "factual",
      "reasoning",
      "multi-turn",
      "long",
      "current information",
      "offline",
      "image",
    ]) {
      expect(stdout, `${category} prompt missing`).toContain(category);
    }

    // The offline prompt must have CONFIRMED it was offline, not assumed it.
    expect(stdout).toMatch(
      /verified offline: (?:no public host reachable|public hosts were reachable before isolation.*proof guard then refused public egress)/,
    );

    // And the image prompt must have confirmed the bytes ARRIVED at the engine.
    // "an image row exists" would pass even if the picture were dropped on the
    // way, which is the one thing this prompt is here to rule out.
    expect(stdout).toMatch(/the engine received the image bytes intact/);
    expect(stdout).not.toMatch(/IMAGE DID NOT ARRIVE/);

    // The timings must not be presented as inference figures.
    expect(stdout).toMatch(/timings are PIPELINE latency, not inference latency/);
  }, 320_000);
});
