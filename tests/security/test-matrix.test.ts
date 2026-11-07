/** The test matrix names only files and CI jobs that exist (194). */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("every file and job the test matrix names exists", () => {
  const matrix = readFileSync("docs/TEST_MATRIX.md", "utf8");
  const workflow = readFileSync(".github/workflows/jarvis-cloud-validation.yml", "utf8");
  const paths = [...matrix.matchAll(/`([\w./-]+\.(?:ts|py|sql|sh|ps1|yml))`/g)].map(([, path]) =>
    path.replace(/\*\.test\.ts$/, "planner.test.ts"),
  );
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
