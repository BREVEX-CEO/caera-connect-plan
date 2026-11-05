import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("Linux cloud gate entry points parse before any evaluation credentials are released", () => {
  for (const script of ["scripts/ci-local.sh", "scripts/jarvis-e1.sh"]) {
    const result = spawnSync("bash", ["-n", script], { encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
  }
});

test("Linux gate refuses an unsupported mode before running any tests", () => {
  const result = spawnSync("bash", ["scripts/ci-local.sh", "--unknown"], { encoding: "utf8" });
  assert.ifError(result.error);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test("evaluation preserves actual target choices and partial checkpoints", () => {
  const result = spawnSync(
    "python3",
    ["-m", "unittest", "discover", "-s", "tests/jarvis", "-p", "test_eval_audit.py", "-v"],
    { encoding: "utf8" },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test("oracle privilege drops exclude the server environment with an actual synthetic canary", () => {
  const result = spawnSync(
    "python3",
    [
      "-c",
      'import sys, unittest; sys.path.insert(0, "tests/jarvis"); suite=unittest.defaultTestLoader.loadTestsFromName("test_eval_isolation.OracleIsolation"); result=unittest.TextTestRunner(verbosity=2).run(suite); sys.exit(0 if result.wasSuccessful() and result.testsRun == 1 and not result.skipped else 1)',
    ],
    { encoding: "utf8" },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
