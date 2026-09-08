#!/usr/bin/env node
/** Prove tracked generators are byte-stable without requiring a `.git` directory. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mode = process.argv[2];
if (mode !== "routes" && mode !== "build") {
  throw new Error("Usage: node scripts/check-generated-stability.mjs <routes|build>");
}

const trackedOutputs = ["src/routeTree.gen.ts", "package-lock.json"];
const before = new Map(trackedOutputs.map((path) => [path, readFileSync(resolve(path))]));
const npmExecPath = process.env.npm_execpath;
const command = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
const args = npmExecPath
  ? [npmExecPath, "run", mode === "routes" ? "routes:generate" : "build"]
  : ["run", mode === "routes" ? "routes:generate" : "build"];
const result = spawnSync(command, args, { cwd: process.cwd(), stdio: "inherit", shell: false });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const changed = trackedOutputs.filter(
  (path) => !before.get(path)?.equals(readFileSync(resolve(path))),
);
if (changed.length > 0) {
  console.error(`Tracked generator output changed: ${changed.join(", ")}`);
  process.exit(1);
}
console.log(`${mode} left every tracked generated authority byte-identical.`);
