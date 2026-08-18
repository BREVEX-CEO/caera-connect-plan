#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const available = pkg.scripts ?? {};
const results = [];

function run(gate, command, args) {
  console.log(`\n=== TEST SPRITE: ${gate} ===`);
  const result = spawnSync(command, args, { stdio: "inherit", env: { ...process.env, CI: "1" } });
  results.push({ gate, status: result.status === 0 ? "passed" : "failed", exitCode: result.status, signal: result.signal ?? null, error: result.error?.message ?? null });
}

run("repo-hardening-source", process.execPath, ["scripts/check-repo-hardening.mjs"]);

const requested = [
  "typecheck", "test", "build", "test:dead-controls", "test:mobile-a11y", "test:session-safety",
  "check:budgets", "check:browser-safety", "check:csp", "check:model-manifest", "check:offline-model",
  "check:voice", "check:source-access-contracts", "check:supabase-types", "check:test-artifacts", "ocade:77-check",
];
for (const name of requested) {
  if (!available[name]) {
    results.push({ gate: name, status: "missing", exitCode: null });
    continue;
  }
  run(name, process.platform === "win32" ? "npm.cmd" : "npm", ["run", name]);
}

const failed = results.filter((row) => row.status === "failed");
const missing = results.filter((row) => row.status === "missing");
const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  totalRequestedGates: results.length,
  passed: results.filter((row) => row.status === "passed").length,
  failed: failed.length,
  missing: missing.length,
  errors: failed.length + missing.length,
  results,
};
writeFileSync("TEST_SPRITE_REPORT.json", `${JSON.stringify(report, null, 2)}\n`);
console.log("\n=== TEST SPRITE SUMMARY ===");
console.log(JSON.stringify(report, null, 2));
process.exit(report.errors === 0 ? 0 : 1);
