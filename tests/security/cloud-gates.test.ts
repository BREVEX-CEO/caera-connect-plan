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
