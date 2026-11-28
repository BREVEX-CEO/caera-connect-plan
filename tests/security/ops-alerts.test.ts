/** OWN-047 and OWN-049: alert rules fire on errors, quota refusals and spend; the runbook names the real controls. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluate } from "../../src/lib/ops/alert-rules.ts";

const calm = {
  minutes: 15,
  requests: 100,
  errors: 1,
  quotaRefusals: 2,
  spend: 10,
  spendLimit: 100,
};

test("calm traffic raises nothing, and too little traffic never pages on one failure", () => {
  assert.deepEqual(evaluate(calm), []);
  assert.deepEqual(evaluate({ ...calm, requests: 3, errors: 3, quotaRefusals: 3 }), []);
});

test("errors warn at 5% and page at 20%", () => {
  assert.equal(evaluate({ ...calm, errors: 5 })[0]?.severity, "warn");
  assert.equal(evaluate({ ...calm, errors: 20 })[0]?.severity, "page");
});

test("quota refusals warn at 25%", () => {
  assert.equal(evaluate({ ...calm, quotaRefusals: 25 })[0]?.rule, "quota_refusals");
});

test("spend warns at 80% and pages at the ceiling; no ceiling means no spend alert", () => {
  assert.equal(evaluate({ ...calm, spend: 80 })[0]?.severity, "warn");
  assert.equal(evaluate({ ...calm, spend: 100 })[0]?.severity, "page");
  assert.deepEqual(evaluate({ ...calm, spend: 999, spendLimit: 0 }), []);
});

test("the runbook names the real switches, functions and scanners", () => {
  const runbook = readFileSync("docs/INCIDENT_RESPONSE_RUNBOOK.md", "utf8");
  const staff = readFileSync("src/lib/admin/staff.functions.ts", "utf8");
  for (const name of [
    "approveDualControl",
    "breakGlassServiceControl",
    "exportAudit",
    "listAudit",
  ]) {
    assert.ok(runbook.includes(name) && staff.includes(`export const ${name}`), name);
  }
  for (const key of ["jarvis_agent", "jarvis_execution", "jarvis_android"])
    assert.ok(runbook.includes(key), key);
  for (const script of ["audit:history-secrets", "audit:artifact-secrets"]) {
    assert.ok(
      runbook.includes(script) && readFileSync("package.json", "utf8").includes(script),
      script,
    );
  }
  for (const heading of ["Detect", "Contain", "Assess", "Recover", "Record and learn", "Drill"])
    assert.match(runbook, new RegExp(`## \\d+\\. ${heading}`));
});

test("the scheduled sweep runs the housekeeping function and logs only counts", () => {
  const entry = readFileSync("src/cloudflare-entry.ts", "utf8");
  assert.match(entry, /rpc\("ocade_housekeeping"\)/);
  assert.match(entry, /runHousekeepingSweep\(\),/);
  assert.match(entry, /console\.warn\("permits\.audit", JSON\.stringify\(audit\)\)/);
});
