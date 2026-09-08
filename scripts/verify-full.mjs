#!/usr/bin/env node
/**
 * Portable CI parity gate.
 *
 * This is intentionally the same command GitHub runs on ordinary pushes and
 * pull requests. Platform-specific proof remains in the manual/scheduled
 * workflows; everything here is expected to run on a clean Node 22 checkout
 * without credentials or a developer-specific toolchain.
 */
import { spawnSync } from "node:child_process";

const commands = [
  "routes:stable",
  "ocade:77-check",
  "typecheck",
  "lint",
  "format:check",
  "test",
  "test:isolation",
  "build:stable",
  "performance:budget",
  "supabase:types-check",
  "release:source-check",
  "portable-release:check",
  "compatibility-evidence:check",
  "media-lab:check",
  "substitution-fabric:check",
  "private-compute:check",
  "enterprise-browser-policy:check",
  "trust-setup:check",
  "marketplace-bounty:check",
  "blocker-reduction:check",
  "stakeholder-research:check",
  "launch-authority:check",
  "application-lifecycle:check",
  "controls:check",
  "browser-safety:check",
  "monochrome:check",
  "a11y:check",
  "licences:check",
  "stage2:baseline-check",
  "integration:check",
  "mission:check",
  "browser:host-check",
  "extension:check",
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

console.log(`\nverify:full passed ${commands.length} portable gates.`);
