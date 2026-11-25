/** The test matrix names only files and CI jobs that exist (194). */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("every file and job the test matrix names exists", () => {
  const workflow = readFileSync(".github/workflows/jarvis-cloud-validation.yml", "utf8");
  const paths = [
    "tests/security/test-matrix.test.ts",
    ".github/workflows/jarvis-cloud-validation.yml",
    "device-agent/windows/packaging/test_install.ps1",
    "device-agent/windows/packaging/check_frozen.py",
    "device-agent/windows/tests/test_jobs.py",
    "device-agent/windows/tests/test_web.py",
    "tests/web/surface_audit.py",
    "device-agent/windows/tests/test_windows_ui.py",
    "tests/jarvis/db/authority.test.sql",
    "tests/jarvis/db/held-claim-revocation.test.sql",
    "device-agent/windows/tests/test_agent.py",
    "tests/jarvis/contracts.test.ts",
    "device-agent/windows/tests/test_gateway.py",
    "tests/jarvis/db/run.sh",
    "tests/security/injection.test.ts",
    "tests/jarvis/db/injection-privilege.test.sql",
    "device-agent/windows/tests/test_injection.py",
    "device-agent/windows/tests/test_verify_web.py",
    "device-agent/windows/tests/test_mac_ui.py",
    "tests/security/timing.test.ts",
    "device-agent/windows/tests/stability.py",
    "tests/jarvis/db/restore.sh",
    "tests/jarvis/db/rollback-roundtrip.sh",
    "device-agent/windows/tests/test_agent_recovery.py",
    "tests/security/recovery.test.ts",
    "tests/jarvis/live_eval.py",
    ".github/workflows/jarvis-staging-evaluation.yml",
  ];
  assert.ok(paths.length > 15);
  assert.deepEqual(
    paths.filter((path) => !existsSync(path)),
    [],
  );
  for (const job of ["companion-cross-platform"])
    assert.match(workflow, new RegExp(`^  ${job}:$`, "m"));
  assert.match(
    workflow,
    /os: \[ubuntu-latest, windows-2022, windows-2025, macos-15, macos-15-intel\]/,
  );
});
