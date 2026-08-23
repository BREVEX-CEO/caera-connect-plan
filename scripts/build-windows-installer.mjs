#!/usr/bin/env node
/** Reproducibly build the unsigned Windows companion installer for test/review. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  throw new Error("desktop:bundle:windows must run on a Windows release host.");
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(root, "native", "companion", "tauri");
const tauriCli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");

function run(args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: "inherit", shell: false });
  if (result.status !== 0) throw new Error(`${args[0]} failed with exit ${result.status}.`);
}

run([join(root, "scripts", "build-browser-sidecar.mjs")]);
run([join(root, "scripts", "build-gesture-sidecar.mjs")]);
run([tauriCli, "build", "--ci", "--no-sign", "--bundles", "nsis"], tauriDir);

const installer = join(
  tauriDir,
  "target",
  "release",
  "bundle",
  "nsis",
  "OCADE Native Companion_0.1.0_x64-setup.exe",
);
const bytes = readFileSync(installer);
process.stdout.write(
  `${JSON.stringify({
    installer,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    signed: false,
  })}\n`,
);
