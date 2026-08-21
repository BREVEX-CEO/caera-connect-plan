import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { writeFile, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Performance-budget gate — proving the GATE ITSELF can fail.
 *
 * A budget check that cannot fail is decorative: it prints reassuring numbers
 * and blocks nothing. Every other suite in this repository asserts that product
 * code behaves; this one asserts that a GATE behaves, by pushing the real build
 * output over a real budget and requiring a non-zero exit.
 *
 * The oversized asset is planted in `.output/public/assets`, which is generated
 * build output and gitignored, and is removed in a `finally` so the tree is left
 * exactly as found. No production code is modified and no bypass switch is added
 * to the gate — a gate with an "ignore the budget" knob would be worse than no
 * gate at all.
 */

const GATE = join("scripts", "check-asset-budgets.mjs");
const ASSETS = join(".output", "public", "assets");
const PLANTED = join(ASSETS, "zz-budget-probe-oversized.js");

const hasBuild = existsSync(ASSETS);

/**
 * Read the budget out of the gate rather than restating it.
 *
 * This test used to plant a hard-coded 600,000-byte asset "comfortably past"
 * a 550,000-byte budget. When the budget was re-based the literal silently
 * stopped exceeding it, and the test that exists to prove the gate can fail
 * began failing itself. Deriving the size means it tracks any future change.
 */
async function largestJavascriptBudget(): Promise<number> {
  const source = await readFile(GATE, "utf8");
  const match = source.match(/largestJavascriptBytes:\s*([\d_]+)/);
  if (!match) throw new Error("could not read largestJavascriptBytes from the gate");
  return Number(match[1].replace(/_/g, ""));
}

async function runGate(): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await run(process.execPath, [GATE]);
    return { ok: true, stdout, stderr };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

describe.runIf(hasBuild)("asset budget gate", () => {
  it("passes against the current build", async () => {
    const result = await runGate();
    expect(result.ok, result.stderr).toBe(true);
    expect(result.stdout).toContain("Performance budget:");
  });

  it("reports the measured figures, not just a verdict", async () => {
    const { stdout } = await runGate();
    // A gate that only says "ok" cannot be reviewed by a human.
    expect(stdout).toMatch(/assets/);
    expect(stdout).toMatch(/total/);
    expect(stdout).toMatch(/JavaScript/);
    expect(stdout).toMatch(/CSS/);
    expect(stdout).toMatch(/largest JS/);
  });

  it("FAILS when a single JavaScript asset blows the largest-asset budget", async () => {
    // Plant one comfortably past whatever the gate's budget currently is.
    const budget = await largestJavascriptBudget();
    try {
      await writeFile(PLANTED, "x".repeat(budget + 50_000), "utf8");
      const result = await runGate();

      expect(result.ok, "the gate must reject an over-budget asset").toBe(false);
      expect(result.stderr).toMatch(/Production asset budget failed/);
      expect(result.stderr).toMatch(/Largest JavaScript asset bytes/);
    } finally {
      await rm(PLANTED, { force: true });
    }
  });

  it("returns to passing once the oversized asset is gone", async () => {
    // Proves the previous failure was caused by the planted file and that the
    // tree was genuinely restored — not that the gate is simply broken now.
    expect(existsSync(PLANTED)).toBe(false);
    const result = await runGate();
    expect(result.ok, result.stderr).toBe(true);
  });

  it("names every budget it enforces so a failure is actionable", async () => {
    try {
      await writeFile(PLANTED, "x".repeat(600_000), "utf8");
      const { stderr } = await runGate();
      // The message must identify WHICH budget broke and by how much.
      expect(stderr).toMatch(/exceeds \d+/);
    } finally {
      await rm(PLANTED, { force: true });
    }
  });
});

describe.runIf(!hasBuild)("asset budget gate (no build present)", () => {
  it("explains that a build is required rather than passing silently", async () => {
    const result = await runGate();
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/No production assets were found|npm run build/);
  });
});
