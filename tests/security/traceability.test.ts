/** Regeneration must preserve the current independent assessment, not restore historical PASS. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("architecture regeneration preserves the current independent ledger", () => {
  const markdown = readFileSync("evidence/2026-11-01-live/architecture-ledger.md", "utf8");
  const expected = [...markdown.matchAll(/^\| (\d+) \| [^|]+ \| (\w+) \|/gm)].map((match) => ({
    n: Number(match[1]),
    status: match[2],
  }));
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
