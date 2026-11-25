/** Regeneration must preserve the current independent assessment, not restore historical PASS. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("architecture regeneration preserves the current independent ledger", () => {
  // The retained independent JSON ledger has the same 84 statuses as the archived Markdown.
  const independentLedger = JSON.parse(
    readFileSync("evidence/2026-11-23-traceability/architecture-ledger.json", "utf8"),
  ) as { n: number; status: string }[];
  const expected = independentLedger.map(({ n, status }) => ({ n, status }));
  assert.equal(expected.length, 84);
  assert.deepEqual(
    expected.map((row) => row.n),
    Array.from({ length: 84 }, (_, index) => index + 1),
  );
  const folder = mkdtempSync(join(tmpdir(), "ocade-traceability-"));
  try {
    const output = execFileSync(
      process.execPath,
      ["scripts/jarvis-traceability.mjs", "--write", folder],
      { encoding: "utf8" },
    );
    const generated = JSON.parse(
      readFileSync(join(folder, "architecture-ledger.json"), "utf8"),
    ) as { n: number; status: string }[];
    assert.deepEqual(
      generated.map(({ n, status }) => ({ n, status })),
      expected,
      "regeneration must not restore an independently retracted PASS",
    );
    const totals = Object.fromEntries(
      ["PASS", "PARTIAL", "FAIL", "BLOCKED", "UNTESTED"].map((status) => [
        status,
        expected.filter((row) => row.status === status).length,
      ]),
    );
    assert.deepEqual(JSON.parse(output).totals, totals);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
