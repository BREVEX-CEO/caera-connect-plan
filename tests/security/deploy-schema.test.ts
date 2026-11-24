/** OPS-02: production deploy is blocked unless the live database has this checkout's newest migration. */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
// @ts-expect-error -- plain ES module script without type declarations
import { createDeploymentPlan, newestMigration } from "../../scripts/deploy.mjs";

function checkout(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), "ocade-deploy-"));
  mkdirSync(path.join(cwd, "supabase", "migrations"), { recursive: true });
  for (const name of ["20260101000000_a.sql", "20261123150000_b.sql", "README.md"]) {
    writeFileSync(path.join(cwd, "supabase", "migrations", name), "");
  }
  return cwd;
}

const blocker = (env: Record<string, string>) =>
  (createDeploymentPlan({ cwd: checkout(), env, mode: "deploy" }).blockers as string[]).find(
    (text) => text.includes("live database"),
  );

test("the newest migration is the highest 14-digit prefix", () => {
  assert.equal(newestMigration(checkout()), "20261123150000");
});

test("a deploy without the live schema version is blocked", () => {
  assert.match(blocker({}) ?? "", /20261123150000/);
});

test("a deploy against an older live schema is blocked", () => {
  assert.ok(blocker({ OCADE_LIVE_SCHEMA_VERSION: "20260101000000" }));
});

test("the matching live schema version clears that blocker", () => {
  assert.equal(blocker({ OCADE_LIVE_SCHEMA_VERSION: "20261123150000" }), undefined);
});

test("a check run does not need the live schema version", () => {
  const plan = createDeploymentPlan({ cwd: checkout(), env: {}, mode: "check" });
  assert.ok(!(plan.blockers as string[]).some((text) => text.includes("live database")));
});
