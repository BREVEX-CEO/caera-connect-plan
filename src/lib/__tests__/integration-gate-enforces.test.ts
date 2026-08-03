import { describe, it, expect, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * The integration HONESTY gate — proving it rejects a dishonest ledger.
 *
 * `release/OCADE_INTEGRATION_AUDIT.json` is where this project records what is
 * source-only, what is runtime-blocked, and which runtime claims are NOT
 * evidenced. The gate exists to stop that ledger drifting into overstatement.
 *
 * The existing audit test proves the gate PASSES on the current ledger. That is
 * only half the proof: a gate that always passes is decorative, and this is the
 * mechanism the entire honesty apparatus rests on. So each test here corrupts
 * the ledger in ONE specific dishonest way, runs the real gate, and requires a
 * non-zero exit naming that specific problem.
 *
 * SAFETY: the tracked ledger is NEVER written. Each corruption goes to a
 * throwaway copy in a temp directory and the gate is pointed at it through
 * OCADE_AUDIT_LEDGER.
 *
 * This suite used to corrupt the real file and restore it in `afterEach`. That
 * raced with any other test file running the same gate in parallel — the audit
 * test intermittently saw a ledger mid-corruption and failed with
 * "runtime claim must remain false without evidence: mobileRuntimeValidated" —
 * and a run dying mid-test would have left the repository file damaged.
 */

const GATE = "scripts/check-ocade-integration.mjs";
const LEDGER = "release/OCADE_INTEGRATION_AUDIT.json";

const ORIGINAL = readFileSync(LEDGER, "utf8");

const scratch = mkdtempSync(join(tmpdir(), "ocade-ledger-"));
const TEMP_LEDGER = join(scratch, "audit.json");

async function runGate(ledgerPath?: string): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
}> {
  try {
    const { stdout, stderr } = await run(process.execPath, [GATE], {
      env: ledgerPath ? { ...process.env, OCADE_AUDIT_LEDGER: ledgerPath } : process.env,
    });
    return { ok: true, stdout, stderr };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

/**
 * Corrupt a COPY of the ledger and run the gate against it. The tracked file is
 * never opened for writing, so nothing here can race with — or damage — it.
 */
async function withCorruptedLedger(
  mutate: (audit: Record<string, unknown>) => void,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const audit = JSON.parse(ORIGINAL) as Record<string, unknown>;
  mutate(audit);
  writeFileSync(TEMP_LEDGER, JSON.stringify(audit, null, 2) + "\n");
  return runGate(TEMP_LEDGER);
}

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("the honesty gate rejects a dishonest ledger", () => {
  it("FAILS when an unevidenced runtime claim is flipped to true", async () => {
    // This is the headline dishonesty: asserting a runtime was validated when
    // no device, browser or migration has ever run.
    const result = await withCorruptedLedger((audit) => {
      const claims = audit.claims as Record<string, boolean>;
      claims.mobileRuntimeValidated = true;
    });

    expect(result.ok, "a false runtime claim must break the gate").toBe(false);
    expect(result.stderr).toMatch(/runtime claim must remain false/i);
    expect(result.stderr).toMatch(/mobileRuntimeValidated/);
  });

  it("FAILS when any other runtime claim is overstated", async () => {
    const result = await withCorruptedLedger((audit) => {
      const claims = audit.claims as Record<string, boolean>;
      claims.desktopInstallerValidated = true;
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/desktopInstallerValidated/);
  });

  /*
   * These four corruptions need an entry to corrupt. P21 wired every remaining
   * orphan, so the real ledger is now legitimately EMPTY — and a suite that
   * indexed `modules[0]` broke precisely because the repository got healthier.
   *
   * Each test therefore SEEDS its own synthetic entry rather than borrowing one
   * from the tracked ledger. The gate is still the real gate; only the fixture
   * is local, so this keeps proving the gate bites no matter how many genuine
   * orphans exist.
   */
  const seeded = (over: Partial<Record<string, string>> = {}) => ({
    path: "src/lib/utils.ts", // a real file, deliberately NOT an orphan
    classification: "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
    reason: "Synthetic fixture entry used only to prove the gate rejects dishonest ledgers.",
    ...over,
  });

  it("FAILS when the ledger declares an orphan that is not one", async () => {
    /*
     * The invariant is that declared and observed must MATCH. With no genuine
     * orphans left, the way to break it is to declare one that does not exist
     * — the same drift check, exercised from the other direction.
     */
    const result = await withCorruptedLedger((audit) => {
      (audit.nonRuntimeModules as unknown[]).push(seeded());
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/ledger drifted/i);
  });

  it("FAILS when a module is upgraded to a classification it has not earned", async () => {
    const result = await withCorruptedLedger((audit) => {
      (audit.nonRuntimeModules as unknown[]).push(seeded({ classification: "RUNTIME VERIFIED" }));
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/overclaimed/i);
  });

  it("FAILS when a declared reason is too thin to be useful", async () => {
    const result = await withCorruptedLedger((audit) => {
      (audit.nonRuntimeModules as unknown[]).push(seeded({ reason: "later" }));
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/lacks a useful reason/i);
  });

  it("FAILS when a declared module path does not exist", async () => {
    const result = await withCorruptedLedger((audit) => {
      (audit.nonRuntimeModules as unknown[]).push(
        seeded({ path: "src/lib/skills/this-module-does-not-exist.ts" }),
      );
    });
    expect(result.ok).toBe(false);
    // Either the drift check or the existence check must catch it.
    expect(result.stderr).toMatch(/missing|drifted/i);
  });

  it("reports how many checks failed, not just that something did", async () => {
    const result = await withCorruptedLedger((audit) => {
      (audit.claims as Record<string, boolean>).liveSupabaseValidated = true;
    });
    expect(result.stderr).toMatch(/honesty gate failed \(\d+\/\d+ checks\)/);
  });
});

describe("the tracked ledger is never touched", () => {
  it("leaves the ledger byte-identical to how it was found", () => {
    expect(readFileSync(LEDGER, "utf8")).toBe(ORIGINAL);
  });

  it("passes against the real ledger", async () => {
    const result = await runGate();
    expect(result.ok, result.stderr).toBe(true);
    expect(result.stdout).toContain("checks passed");
  });
});
