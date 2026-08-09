import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const executable = resolve("native/companion/tauri/target/release/caera-companion.exe");
const installer = resolve(
  "native/companion/tauri/target/release/bundle/nsis/CAERA Companion_0.1.0_x64-setup.exe",
);
const output = resolve("release/OCADE_PACKAGED_STARTUP_EVIDENCE.json");
const bytes = await readFile(executable);
const installerBytes = await readFile(installer);
const startedAt = new Date();
const child = spawn(executable, [], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr = `${stderr}${String(chunk)}`.slice(-8_000);
});
await new Promise((resolveWait) => setTimeout(resolveWait, 5_000));
const aliveAfterFiveSeconds = child.exitCode === null && child.signalCode === null;
if (aliveAfterFiveSeconds) child.kill();
await new Promise((resolveWait) => {
  if (child.exitCode !== null || child.signalCode !== null) resolveWait();
  else child.once("exit", resolveWait);
});
if (!aliveAfterFiveSeconds) {
  throw new Error(
    `Packaged companion exited during startup: ${stderr || `exit ${child.exitCode}`}`,
  );
}

const receipt = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  executable,
  bytes: bytes.byteLength,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  signed: false,
  installer: {
    path: installer,
    bytes: installerBytes.byteLength,
    sha256: createHash("sha256").update(installerBytes).digest("hex"),
    signed: false,
  },
  assertions: {
    processAliveAfterFiveSeconds: true,
    startupPanicAbsent: !/panicked|PluginInitialization/i.test(stderr),
    browserExtensionRequired: false,
    legacy510Required: false,
  },
  startedAt: startedAt.toISOString(),
  stoppedAfterEvidence: true,
  claimBoundary:
    "This proves the rebuilt unpackaged Windows release executable starts and stays alive. It does not prove code signing, installer execution, authentication, or a full GUI mission.",
};
if (process.argv.includes("--write")) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
