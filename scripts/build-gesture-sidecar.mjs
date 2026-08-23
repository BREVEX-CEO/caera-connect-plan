#!/usr/bin/env node
/** Build MediaPipe hand control as a self-contained Tauri sidecar. */
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = join(root, "native", "python-host");
const stage = join(root, ".gesture-sidecar");
const binaries = join(root, "native", "companion", "tauri", "binaries");
const extension = process.platform === "win32" ? ".exe" : "";
const python =
  process.env.OCADE_GESTURE_PYTHON?.trim() ||
  join(host, ".venv-gesture", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const bootstrapPython =
  process.env.OCADE_BOOTSTRAP_PYTHON?.trim() ||
  (process.platform === "win32" ? "python" : "python3");
const model = join(host, "models", "hand_landmarker.task");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    const detail = options.capture ? `${result.stdout || ""}${result.stderr || ""}`.trim() : "";
    throw new Error(`${command} failed with exit ${result.status}.${detail ? `\n${detail}` : ""}`);
  }
  return options.capture ? String(result.stdout).trim() : "";
}

if (!existsSync(python)) {
  run(bootstrapPython, ["-m", "venv", join(host, ".venv-gesture")], { cwd: host });
}
const environmentReady =
  spawnSync(python, ["-c", "import cv2, mediapipe, PyInstaller, pynput, pyautogui"], {
    cwd: host,
    stdio: "ignore",
    shell: false,
  }).status === 0;
if (!environmentReady) {
  run(
    python,
    [
      "-m",
      "pip",
      "install",
      "--disable-pip-version-check",
      "-r",
      join(host, "requirements-gesture.txt"),
      "-r",
      join(host, "requirements-gesture-build.txt"),
    ],
    { cwd: host },
  );
}
if (!existsSync(model)) {
  run(python, ["-m", "ocade_host.gesture.download_model"], { cwd: host });
}

const configuredTriple = process.env.OCADE_SIDECAR_TRIPLE?.trim();
const triple = configuredTriple || run("rustc", ["--print", "host-tuple"], { capture: true });
if (!/^[a-z0-9_.-]+$/i.test(triple)) throw new Error("Rust returned an invalid host triple.");

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
mkdirSync(binaries, { recursive: true });

const addDataSeparator = process.platform === "win32" ? ";" : ":";
run(
  python,
  [
    "-m",
    "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onefile",
    "--windowed",
    "--name",
    "ocade-gesture-host",
    "--paths",
    host,
    "--add-data",
    `${model}${addDataSeparator}models`,
    "--collect-all",
    "mediapipe",
    "--collect-all",
    "cv2",
    "--hidden-import",
    "pynput.mouse._win32",
    "--distpath",
    join(stage, "dist"),
    "--workpath",
    join(stage, "build"),
    "--specpath",
    stage,
    join(host, "gesture_entry.py"),
  ],
  { cwd: host },
);

const built = join(stage, "dist", `ocade-gesture-host${extension}`);
const output = join(binaries, `ocade-gesture-host-${triple}${extension}`);
copyFileSync(built, output);
if (process.platform !== "win32") chmodSync(output, 0o755);

const selfTest = JSON.parse(run(output, ["--self-test"], { capture: true }));
if (selfTest.protocolVersion !== 1 || selfTest.modelBundled !== true) {
  throw new Error("The compiled gesture sidecar failed its self-test.");
}
process.stdout.write(`${JSON.stringify({ output, triple, selfTest })}\n`);
