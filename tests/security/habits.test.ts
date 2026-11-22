/** Private habits (R12-10): only outcomes asked for twice and verified every time are offered. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { habits } from "../../src/lib/jarvis/habits.ts";

const verified = (title: string) => ({
  title,
  outcome: [{ id: "c1" }, { id: "c2" }],
  checkpoint: { verification: { passed: ["c1", "c2"] } },
});

test("repeated verified outcomes only, top three, by count", () => {
  const found = habits([
    verified("Tidy  my Downloads"),
    verified("tidy my downloads"),
    verified("Weekly report"),
    verified("Weekly report"),
    verified("Weekly report"),
    verified("Once only"),
    { ...verified("Once only"), mode: "rehearsal" },
    { ...verified("Only simulated"), mode: "rehearsal" },
    { ...verified("Only simulated"), mode: "rehearsal" },
    { ...verified("Unverified"), checkpoint: { verification: { passed: ["c1"] } } },
    { ...verified("Unverified"), checkpoint: null },
    { ...verified("Unverified"), checkpoint: { verification: { passed: ["c1", "c1"] } } },
    { ...verified("Unverified"), checkpoint: { verification: { passed: ["other", "c2"] } } },
    { title: "No checks", outcome: [], checkpoint: {} },
    { title: "No checks", outcome: [], checkpoint: {} },
  ]);
  assert.deepEqual(found, [
    { title: "Weekly report", times: 3 },
    { title: "Tidy  my Downloads", times: 2 },
  ]);
});
