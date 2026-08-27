import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const script = readFileSync(resolve(root, "scripts/launch-prove.mjs"), "utf8");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

describe("launch:prove", () => {
  it("is the package-level launch proof command", () => {
    expect(pkg.scripts["launch:prove"]).toBe("node scripts/launch-prove.mjs");
    expect(pkg.scripts["launch:prove:defer-windows"]).toBe(
      "node scripts/launch-prove.mjs --defer-windows",
    );
  });

  it("runs safety, stress, build, model, database-type and Windows proof gates", () => {
    for (const gate of [
      "test:isolation",
      "test:mutation",
      "controls:check",
      "performance:budget",
      "model:distribution-check",
      "supabase:types-check",
      "windows:prove",
    ]) {
      expect(script).toContain(`"${gate}"`);
    }
  });

  it("keeps source-merge readiness separate from production-launch authority", () => {
    expect(script).toContain("const readyToMerge = sourceFailures.length === 0");
    expect(script).toContain("const readyToLaunch =");
    expect(script).toContain("externalBlockers.length === 0");
    expect(script).toContain("authorityBlocked.length === 0");
    expect(script).toContain("SOURCE MERGE READY; LAUNCH REFUSED");
  });

  it("records an owner-directed Windows deferral without fabricating a pass", () => {
    expect(script).toContain('process.argv.includes("--defer-windows")');
    expect(script).toContain('status: "deferred_not_executed"');
    expect(script).toContain('classification: "DEFERRED / NOT FINAL-PROVEN"');
    expect(script).toContain("deferredGates.length === 0");
  });

  it("keeps stdout and stderr evidence separate so warnings cannot hide pass totals", () => {
    expect(script).toContain("stdoutTail: tail(run.stdout");
    expect(script).toContain("stderrTail: tail(run.stderr");
  });

  it("binds the receipt to a commit and records any pre-existing dirty state", () => {
    expect(script).toContain('gitOutput(["rev-parse", "HEAD"])');
    expect(script).toContain('gitOutput(["status", "--short"])');
    expect(script).toContain("testedCommit,");
    expect(script).toContain("startingChanges,");
  });

  it("does not call a deploy, publish, signing, charging or live migration command", () => {
    for (const forbidden of [
      "deploy:web",
      "deploy:rollback",
      "supabase db push",
      "paddle",
      "git merge",
    ])
      expect(script).not.toContain(`"${forbidden}"`);
  });
});
