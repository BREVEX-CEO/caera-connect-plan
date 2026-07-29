import { describe, it, expect, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * The release-source gate — proving it rejects an overstated release ledger.
 *
 * `release/OCADE_RELEASE_BLOCKERS.json` is the record that says this project is
 * SOURCE READY but NOT releasable, and names the external prerequisites that
 * hold it back. It is the document that stops "source complete" being reported
 * as "shippable".
 *
 * The gate is already run by other tests, which prove it PASSES. This suite
 * proves it FAILS — each test overstates readiness in one specific way and
 * requires a non-zero exit naming that problem. Without this, the release claim
 * rests on a check nobody has ever seen reject anything.
 *
 * SAFETY: original bytes captured at module load, rewritten in `afterEach`, so
 * the file is byte-identical after every test including on failure. This file
 * is UNTRACKED, so there is no git recovery path — closing tests assert the
 * restoration actually held.
 */

const GATE = "scripts/check-release-source.mjs";
const LEDGER = "release/OCADE_RELEASE_BLOCKERS.json";

const ORIGINAL = readFileSync(LEDGER, "utf8");

async function runGate(): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await run(process.execPath, [GATE]);
    return { ok: true, stdout, stderr };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

async function withCorrupted(
  mutate: (ledger: Record<string, unknown>) => void,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const ledger = JSON.parse(ORIGINAL) as Record<string, unknown>;
  mutate(ledger);
  writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + "\n");
  return runGate();
}

afterEach(() => {
  writeFileSync(LEDGER, ORIGINAL);
});

describe("the release gate rejects an overstated ledger", () => {
  it("FAILS when the ledger declares the release is no longer blocked", async () => {
    // The headline overstatement: claiming shippable while no deployment,
    // signing or device verification has happened.
    const result = await withCorrupted((ledger) => {
      ledger.status = "ready";
    });
    expect(result.ok, "claiming release readiness must break the gate").toBe(false);
    expect(result.stderr).toMatch(/overstates release readiness/i);
  });

  it("FAILS when blockers are deleted to shrink the list below the required minimum", async () => {
    const result = await withCorrupted((ledger) => {
      ledger.blockers = (ledger.blockers as unknown[]).slice(0, 2);
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/incomplete/i);
  });

  it("FAILS when a single blocker is quietly marked resolved", async () => {
    const result = await withCorrupted((ledger) => {
      const blockers = ledger.blockers as Array<Record<string, unknown>>;
      blockers[0].status = "resolved";
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/incomplete/i);
  });

  it("FAILS when a blocker names no evidence that would clear it", async () => {
    // A blocker with no required evidence can be declared cleared on a whim.
    const result = await withCorrupted((ledger) => {
      const blockers = ledger.blockers as Array<Record<string, unknown>>;
      blockers[0].requiredEvidence = [];
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/incomplete/i);
  });

  it("FAILS when the ledger version drifts from the package version", async () => {
    const result = await withCorrupted((ledger) => {
      ledger.releaseVersion = "9.9.9";
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/version differs/i);
  });

  it("FAILS when a secret-shaped value is committed into the ledger", async () => {
    const result = await withCorrupted((ledger) => {
      const blockers = ledger.blockers as Array<Record<string, unknown>>;
      blockers[0].note = `sk-${"a".repeat(24)}`;
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/secret-shaped value/i);
  });

  it("reports how many checks failed", async () => {
    const result = await withCorrupted((ledger) => {
      ledger.status = "ready";
    });
    expect(result.stderr).toMatch(/release source gate failed \(\d+\/\d+ checks\)/);
  });
});

describe("restoration held", () => {
  it("leaves the ledger byte-identical to how it was found", () => {
    expect(readFileSync(LEDGER, "utf8")).toBe(ORIGINAL);
  });

  it("passes again on the restored ledger and still reports it as blocked", async () => {
    const result = await runGate();
    expect(result.ok, result.stderr).toBe(true);
    expect(result.stdout).toMatch(/EXTERNALLY BLOCKED/);
  });
});
