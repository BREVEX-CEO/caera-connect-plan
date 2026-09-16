#!/usr/bin/env node
/**
 * THE ONE GATE LIST.
 *
 * Exactly what CI runs on a push, in the order a failure is cheapest to read:
 * the generated tree first, then the compiler, then style, then the tests, then
 * the build, then the audits that read the built output.
 *
 * It used to name thirty-eight gates, thirty of which belonged to products that
 * no longer exist — a list nobody could run locally and CI had stopped
 * believing. Every entry below is a script in `package.json` with a subject in
 * this tree; there is no second list anywhere.
 */
import { spawnSync } from "node:child_process";

const commands = [
  "routes:stable",
  "typecheck",
  "lint",
  "format:check",
  "test",
  "build:stable",
  "audit:secrets",
  "supabase:types-check",
  "content-storage:check",
  "reads:check",
  "controls:check",
  "a11y:check",
  "monochrome:check",
  "identity:check",
  "reachability:check",
];

const npmExecPath = process.env.npm_execpath;
const executable = npmExecPath
  ? process.execPath
  : process.platform === "win32"
    ? "npm.cmd"
    : "npm";

for (const command of commands) {
  console.log(`\n=== npm run ${command} ===`);
  const args = npmExecPath ? [npmExecPath, "run", command] : ["run", command];
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`verify:full stopped at npm run ${command}.`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\nverify:full passed ${commands.length} gates.`);
