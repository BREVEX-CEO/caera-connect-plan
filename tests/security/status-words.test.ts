/** RELIABILITY-06: what a step did, whether the task is verified, and what a key has spent are separate statuses with their own words. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authority = readFileSync("src/lib/jarvis/authority.server.ts", "utf8");

test("a step's outcome comes from a closed vocabulary", () => {
  const body = /function receiptDisposition\([\s\S]*?\n\}\n/.exec(authority)?.[0] ?? "";
  const words = new Set(
    [...body.matchAll(/(?:return\b[^;"]*?|[?:])\s*"([a-z ]+)"/g)].map((m) => m[1]),
  );
  assert.deepEqual([...words].sort(), [
    "cancelled",
    "executed",
    "failed",
    "outcome unknown",
    "refused",
    "verified",
  ]);
});

test("the task view keeps step outcome, verification state and spending in different fields", () => {
  for (const field of ["steps:", "checks:", "finalVerification", "blocker:", "timing,"]) {
    assert.ok(authority.includes(field), field);
  }
  const verification =
    /state: verification\?\.failed[\s\S]*?"unchecked"/.exec(authority)?.[0] ?? "";
  for (const word of ["failed", "passed", "unverified", "unchecked"])
    assert.ok(verification.includes(`"${word}"`), word);
  const panels = readFileSync("src/jarvis/JarvisPanels.tsx", "utf8");
  assert.match(panels, /so far/, "a customer key's spend is shown in its own words");
});
