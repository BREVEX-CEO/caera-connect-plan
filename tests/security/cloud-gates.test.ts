import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

test("staging isolation smoke refuses an uncredentialed process", () => {
  const environment = { ...process.env };
  delete environment.SUPABASE_URL;
  delete environment.SUPABASE_SERVICE_ROLE_KEY;
  const result = spawnSync("python3", ["scripts/jarvis-staging-isolation.py"], {
    encoding: "utf8",
    env: environment,
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /REFUSED: an isolated root staging step is required/);
});

test("coding gate detects SQL and authority changes and fails on an invalid comparison", () => {
  const workflow = readFileSync(".github/workflows/jarvis-cloud-validation.yml", "utf8");
  const block = workflow.match(
    /name: Migrations and authority contracts when changed\n[\s\S]*?run: \|\n((?: {10}[^\n]*\n)+)/,
  )?.[1];
  assert.ok(block, "the real coding-gate migration step must exist");
  const script = block.replace(/^ {10}/gm, "");
  const folder = mkdtempSync(join(tmpdir(), "ocade-coding-diff-"));
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: folder, encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
  };
  const commit = () => {
    git("add", ".");
    git(
      "-c",
      "user.name=Coding gate fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "fixture",
    );
  };
  const run = () =>
    spawnSync("bash", ["-e", "-c", "npm() { printf 'DB_GATE_REQUESTED\\n'; }\n" + script], {
      cwd: folder,
      encoding: "utf8",
    });
  try {
    git("init", "-q");
    writeFileSync(join(folder, "baseline"), "baseline");
    commit();
    assert.notEqual(run().status, 0, "a missing parent must fail, not skip the gate");
    for (const path of [
      "docs/fixture.md",
      "supabase/migrations/fixture.sql",
      "src/lib/jarvis/authority.server.ts",
      "tests/jarvis/db/fixture.sql",
    ]) {
      mkdirSync(dirname(join(folder, path)), { recursive: true });
      writeFileSync(join(folder, path), "fixture");
      commit();
      const result = run();
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.includes("DB_GATE_REQUESTED"), !path.startsWith("docs/"), path);
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
