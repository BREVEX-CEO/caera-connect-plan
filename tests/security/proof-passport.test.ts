/**
 * Proof Passport (T12-07): VERIFIED only when every check passed on a completed task; a failed
 * check or an unknown effect is never VERIFIED; an altered manifest fails its integrity check.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPassport,
  passportIntact,
  passportReport,
  passportStatus,
} from "../../src/lib/jarvis/proof-passport.ts";

const task = {
  id: "t1",
  title: "Make the report",
  status: "completed",
  device: "Work PC",
  checks: [
    { id: "c1", description: "report.docx exists", state: "passed" },
    { id: "c2", description: "has 3 headings", state: "passed" },
  ],
  steps: [{ summary: "Writing the report", status: "done", disposition: "verified", lane: 0 }],
  artifactFiles: [{ path: "OCADE output/report.docx", sha256: "a".repeat(64) }],
  timing: { acceptedAt: "2026-11-21T10:00:00.000Z", finishedAt: "2026-11-21T10:02:00.000Z" },
};

test("the status never claims more than the checks", () => {
  assert.equal(passportStatus(task), "VERIFIED");
  const failed = { ...task, checks: [{ ...task.checks[0]!, state: "failed" }, task.checks[1]!] };
  assert.equal(passportStatus(failed), "FAILED");
  const unknown = { ...task, steps: [{ ...task.steps[0]!, disposition: "outcome unknown" }] };
  assert.equal(passportStatus(unknown), "UNKNOWN EFFECT");
  const partial = {
    ...task,
    checks: [task.checks[0]!, { ...task.checks[1]!, state: "unverified" }],
  };
  assert.equal(passportStatus(partial), "PARTIALLY VERIFIED");
  assert.equal(passportStatus({ ...task, status: "running" }), "NOT FINISHED");
});

test("the manifest carries its integrity hash and an altered one fails", async () => {
  const passport = await buildPassport(task, new Date("2026-11-21T11:00:00Z"));
  assert.equal(passport.signature, null, "unsigned, and says so");
  assert.ok(await passportIntact(passport as never));
  const altered = { ...passport, status: "VERIFIED", checks: [] };
  assert.equal(await passportIntact({ ...altered, status: "FAILED" } as never), false);
  assert.match(passportReport(passport), /VERIFIED[\s\S]*report\.docx {2}a{64}/);
});
