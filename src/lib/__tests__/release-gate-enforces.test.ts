import { describe, it, expect, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
 * SAFETY: the tracked ledger is never written to. Each case corrupts its own
 * temporary copy and points the gate at it via `OCADE_RELEASE_BLOCKERS`. The
 * closing tests confirm the real file is untouched and still passes — see the
 * note on `scratch` below for the race this replaced.
 */

const GATE = "scripts/check-release-source.mjs";
const LEDGER = "release/OCADE_RELEASE_BLOCKERS.json";

const ORIGINAL = readFileSync(LEDGER, "utf8");

/**
 * A scratch directory, so the tracked ledger is never written to.
 *
 * THE DEFECT THIS FIXES. These tests used to corrupt the REAL ledger and
 * restore it in `afterEach`. Vitest runs test files in parallel, and
 * `release-package.test.ts` reads the same file — so it could observe a
 * deliberately corrupted ledger mid-flight and fail for reasons that had
 * nothing to do with it. That presented as an intermittent failure of five or
 * six tests in this file, which passed in isolation every time, and it was
 * repeatedly written off as a Windows file-lock quirk. It was a
 * shared-mutable-state race between test files.
 *
 * The gate now takes `OCADE_RELEASE_BLOCKERS`, so each case can point it at its
 * own corrupted copy. Nothing shared is mutated, the race is gone, and the
 * hazard the old approach carried goes with it: this ledger is UNTRACKED, so a
 * crash between corrupt and restore had no git recovery path.
 */
const scratch = mkdtempSync(join(tmpdir(), "ocade-release-gate-"));

async function runGate(ledgerPath?: string): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
}> {
  try {
    const { stdout, stderr } = await run(process.execPath, [GATE], {
      env: ledgerPath ? { ...process.env, OCADE_RELEASE_BLOCKERS: ledgerPath } : process.env,
    });
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
  const path = join(scratch, `ledger-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(path, JSON.stringify(ledger, null, 2) + "\n");
  return runGate(path);
}

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
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

    if (result.ok) {
      expect(result.stdout).toMatch(/EXTERNALLY BLOCKED/);
      return;
    }

    /*
     * The gate ALSO verifies the production build output (`.output/server/...`),
     * which is not this suite's subject — the ledger is. `npm run test`
     * legitimately runs before `npm run build`, both here and in ci.yml, where
     * "Unit tests" precedes "Production build". Requiring a clean exit made this
     * test pass only on a machine that happened to have a stale build lying
     * around, and fail in every fresh checkout and in CI.
     *
     * So accept that ONE prerequisite failure and nothing else: every ledger
     * check must still have passed. A regression in any of them fails here.
     */
    expect(result.stderr, "the restored ledger must not fail any ledger check").not.toMatch(
      /overstates|incomplete|version differs|secret-shaped|approval boundaries|unverified live claim/i,
    );
    expect(result.stderr, "the only tolerated failure is the missing build output").toMatch(
      /production output is missing/,
    );
  });
});
