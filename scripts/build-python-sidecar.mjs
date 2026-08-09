#!/usr/bin/env node
/** Build the bounded Python perception/control host as a Tauri sidecar. */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, ".python-sidecar");
const binaries = join(root, "native", "companion", "tauri", "binaries");
const python = join(root, ".venv", "Scripts", "python.exe");
const model = join(process.env.LOCALAPPDATA || "", "OCADE", "models", "hand_landmarker.task");
const tesseract = "C:\\Program Files\\Tesseract-OCR";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    input: options.input,
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = `${result.stdout || ""}${result.stderr || ""}`.trim();
    throw new Error(`${command} failed with exit ${result.status}.${detail ? `\n${detail}` : ""}`);
  }
  return options.capture ? String(result.stdout).trim() : "";
}

function hostTriple() {
  const configured = process.env.OCADE_SIDECAR_TRIPLE?.trim();
  if (configured) return configured;
  return run("rustc", ["--print", "host-tuple"], { capture: true });
}

if (!existsSync(python)) throw new Error("Run the pinned Python environment setup first.");
if (!existsSync(model)) throw new Error("Run npm run python:models before building the sidecar.");

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
mkdirSync(binaries, { recursive: true });

const separator = process.platform === "win32" ? ";" : ":";
const args = [
  "-m",
  "PyInstaller",
  "--noconfirm",
  "--clean",
  "--onefile",
  "--name",
  "ocade-python-host",
  "--distpath",
  join(stage, "dist"),
  "--workpath",
  join(stage, "work"),
  "--specpath",
  stage,
  "--paths",
  join(root, "native", "python-host"),
  "--additional-hooks-dir",
  join(root, "native", "python-host", "hooks"),
  "--collect-data",
  "mediapipe",
  "--collect-binaries",
  "mediapipe",
  "--hidden-import",
  "mediapipe.tasks.python.vision",
  "--collect-all",
  "pyttsx3",
  "--collect-all",
  "comtypes",
  "--hidden-import",
  "pywinauto",
  "--hidden-import",
  "pynput.keyboard._win32",
  "--add-data",
  `${model}${separator}models`,
];
if (existsSync(tesseract)) args.push("--add-binary", `${tesseract}${separator}Tesseract-OCR`);
args.push(join(root, "native", "python-host", "ocade_python_host.py"));
run(python, args);

const triple = hostTriple();
if (!/^[a-z0-9_.-]+$/i.test(triple)) throw new Error("Rust returned an invalid host triple.");
const built = join(stage, "dist", `ocade-python-host${process.platform === "win32" ? ".exe" : ""}`);
const output = join(
  binaries,
  `ocade-python-host-${triple}${process.platform === "win32" ? ".exe" : ""}`,
);
copyFileSync(built, output);
const response = run(output, [], {
  capture: true,
  input: `${JSON.stringify({ id: 1, command: "health", params: {} })}\n`,
});
const lines = response.split(/\r?\n/).filter(Boolean);
const parsed = JSON.parse(lines.at(-1));
if (parsed.ok !== true || parsed.result?.transport !== "inherited-stdio-only") {
  throw new Error("The compiled Python sidecar failed its inherited-pipe self-test.");
}
process.stdout.write(
  `${JSON.stringify({ output, triple, bytes: statSync(output).size, selfTest: parsed.result })}\n`,
);
