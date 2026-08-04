import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The test-kind gate — proving it rejects a dishonest ledger.
 *
 * A gate that always passes is decorative. Each case here corrupts a COPY of
 * the ledger in one specific way and requires the real gate to exit non-zero
 * naming that problem. The tracked ledger is never written.
 */
const GATE = "scripts/check-test-kinds.mjs";
const LEDGER = "release/OCADE_TEST_KINDS.json";
const ORIGINAL = readFileSync(LEDGER, "utf8");
const scratch = mkdtempSync(join(tmpdir(), "ocade-kinds-"));

function runGate(ledgerPath?: string) {
  try {
    const stdout = execFileSync(process.execPath, [GATE], {
      encoding: "utf8",
      env: ledgerPath ? { ...process.env, OCADE_TEST_KIND_LEDGER: ledgerPath } : process.env,
    });
    return { ok: true, out: stdout };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

function withCorrupted(mutate: (l: Record<string, unknown>) => void) {
  const ledger = JSON.parse(ORIGINAL) as Record<string, unknown>;
  mutate(ledger);
  const path = join(scratch, `ledger-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(path, JSON.stringify(ledger, null, 2));
  return runGate(path);
}

describe("the test-kind gate", () => {
  it("passes on the tracked ledger", () => {
    expect(runGate().ok).toBe(true);
  });

  it("FAILS when a structural-only test is undeclared", () => {
    const r = withCorrupted((l) => {
      (l.structuralOnly as unknown[]).pop();
    });
    expect(r.ok).toBe(false);
    expect(r.out).toMatch(/not declared in the ledger/);
  });

  it("FAILS when a declared reason is too thin to be useful", () => {
    const r = withCorrupted((l) => {
      (l.structuralOnly as Array<Record<string, string>>)[0].why = "later";
    });
    expect(r.ok).toBe(false);
    expect(r.out).toMatch(/lacks a real reason/);
  });

  it("FAILS when the ledger declares a test that now executes", () => {
    // This is the case that matters: a test which became executable must not
    // stay classified as structural, or the classification rots into a excuse.
    const r = withCorrupted((l) => {
      (l.structuralOnly as unknown[]).push({
        path: "src/lib/__tests__/pc-transaction.test.ts",
        why: "This test actually executes production code, so declaring it structural is false.",
      });
    });
    expect(r.ok).toBe(false);
    expect(r.out).toMatch(/now executes|no longer exists/);
  });

  it("leaves the tracked ledger byte-identical", () => {
    expect(readFileSync(LEDGER, "utf8")).toBe(ORIGINAL);
    rmSync(scratch, { recursive: true, force: true });
  });
});
