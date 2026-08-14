#!/usr/bin/env node
/**
 * Install the Python packages the control engine needs, once, at install time.
 *
 * WHY A SCRIPT AND NOT AN AUTO-INSTALLER
 * ---------------------------------------
 * `native/python-host/tests/test_engine_ships_safely.py` forbids any file in
 * the engine from shelling out to pip, and that rule is not negotiable: a
 * shipped binary that rewrites its own dependencies at runtime is read by
 * antivirus and code-signing review as exactly what it resembles, and it means
 * a spoken reply can change what is installed on a paying customer's computer.
 *
 * This script is the other half of that rule rather than an exception to it.
 * The dependency set is resolved ONCE, deliberately, by a person running a
 * command — never by the engine mid-task. Nothing here is imported by the
 * engine and nothing in the engine calls it.
 *
 * WHY IT VERIFIES BY IMPORTING RATHER THAN BY TRUSTING pip
 * ---------------------------------------------------------
 * `pip install` printing "Successfully installed" is not evidence that the
 * package can be used. A wheel can land for the wrong architecture, a package
 * can install under a name that does not match its import, and a compiled
 * extension can fail to load long after pip has declared victory. Every row in
 * the table below is the result of actually importing the module in the target
 * interpreter, before and after. That is the same standard the rest of OCADE
 * holds itself to: the receipt comes from re-reading the thing, not from the
 * call returning.
 *
 *   node scripts/install-python-deps.mjs            install what is missing
 *   node scripts/install-python-deps.mjs --check    report only, change nothing
 *   node scripts/install-python-deps.mjs --force    reinstall everything
 *
 * Exits non-zero when any package is still unimportable at the end, so CI and
 * a setup step can both tell the difference between "done" and "mostly done".
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The interpreter the engine ACTUALLY runs under.
 *
 * Mirrors `src/lib/agent/host-paths.node.ts`. Installing into a system Python
 * is the most common way this goes wrong: pip reports success, every package
 * lands, and the engine — which runs from this venv and only this venv —
 * still cannot import any of them.
 */
const PYTHON =
  process.platform === "win32"
    ? join(ROOT, "native", "python-host", ".venv", "Scripts", "python.exe")
    : join(ROOT, "native", "python-host", ".venv", "bin", "python");

/**
 * pip name → the name you actually import.
 *
 * They differ often enough that assuming they match would make the
 * verification step report failures that are not real (`pywin32` imports as
 * `win32api`, `opencv-python` as `cv2`) and successes that are not either.
 */
const PACKAGES = [
  { pip: "uiautomation", imports: "uiautomation", why: "UIA tree access" },
  { pip: "pywinauto", imports: "pywinauto", why: "UIA control patterns" },
  { pip: "pyautogui", imports: "pyautogui", why: "pointer fallback" },
  { pip: "pywin32", imports: "win32api", why: "window handles, SAPI voice" },
  { pip: "psutil", imports: "psutil", why: "CPU, memory, processes" },
  { pip: "pycaw", imports: "pycaw", why: "system volume" },
  { pip: "faster-whisper", imports: "faster_whisper", why: "offline speech-to-text" },
  { pip: "mss", imports: "mss", why: "screen capture" },
  { pip: "pillow", imports: "PIL", why: "image handling" },
  { pip: "pandas", imports: "pandas", why: "spreadsheets" },
  { pip: "python-docx", imports: "docx", why: "Word documents" },
  /*
   * `webrtcvad-wheels`, NOT `webrtcvad`, and the difference is load-bearing.
   * Plain `webrtcvad` ships no Windows wheel and builds from source, so it
   * needs a C compiler that a user machine will not have — see the note in
   * native/ocade_control_engine/requirements.txt. The fork provides prebuilt
   * binaries and the SAME `webrtcvad` import name.
   */
  { pip: "webrtcvad-wheels", imports: "webrtcvad", why: "voice activity detection" },
  { pip: "sounddevice", imports: "sounddevice", why: "microphone input" },
  { pip: "soundfile", imports: "soundfile", why: "audio files" },
  {
    pip: "screen_brightness_control",
    imports: "screen_brightness_control",
    why: "display brightness",
  },
  { pip: "wmi", imports: "wmi", why: "hardware sensors" },
  { pip: "pyperclip", imports: "pyperclip", why: "clipboard" },
  { pip: "comtypes", imports: "comtypes", why: "COM, required by pycaw" },
  { pip: "numpy", imports: "numpy", why: "audio and image arrays" },
  { pip: "requests", imports: "requests", why: "HTTP to the local model" },
  { pip: "pygetwindow", imports: "pygetwindow", why: "window enumeration" },
  { pip: "opencv-python", imports: "cv2", why: "image matching" },
  { pip: "pynput", imports: "pynput", why: "input listening" },
  { pip: "keyboard", imports: "keyboard", why: "global hotkeys — see the note below" },
  { pip: "mouse", imports: "mouse", why: "global pointer hooks — see the note below" },
  { pip: "plyer", imports: "plyer", why: "desktop notifications" },
  { pip: "SpeechRecognition", imports: "speech_recognition", why: "speech-to-text adapters" },
];

/**
 * Packages that install a SYSTEM-WIDE INPUT HOOK, flagged rather than hidden.
 *
 * `keyboard` and `mouse` do not just send input — they listen to all of it,
 * process-wide, which is the same mechanism a keylogger uses and which needs
 * administrator rights on Windows to install its hook. That may be exactly
 * what a PC-automation product wants, but it is a decision somebody should
 * make on purpose rather than discover in a dependency list, so the table says
 * so every run. OCADE's own code does not import either today: input goes
 * through UI Automation, and `pyautogui` is the pointer fallback.
 */
const GLOBAL_HOOKS = new Set(["keyboard", "mouse", "pynput"]);

const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has("--check");
const FORCE = args.has("--force");

function run(command, commandArgs, { quiet = true } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, commandArgs, {
      stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let out = "";
    child.stdout?.on("data", (chunk) => (out += chunk));
    child.stderr?.on("data", (chunk) => (out += chunk));
    child.on("error", (error) => resolvePromise({ code: -1, out: String(error.message) }));
    child.on("close", (code) => resolvePromise({ code: code ?? -1, out }));
  });
}

/** Can the target interpreter import this module RIGHT NOW? */
async function importable(moduleName) {
  const { code } = await run(PYTHON, ["-c", `import ${moduleName}`]);
  return code === 0;
}

/** One pass over every package, so before/after can be compared honestly. */
async function survey() {
  const state = new Map();
  await Promise.all(
    PACKAGES.map(async (pkg) => state.set(pkg.pip, await importable(pkg.imports))),
  );
  return state;
}

function bar(width) {
  return "─".repeat(width);
}

function table(rows) {
  const headers = ["PACKAGE", "IMPORTS AS", "STATUS", "WHAT IT IS FOR"];
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index]).length)),
  );
  const line = (cells, pad = " ") =>
    cells.map((cell, index) => String(cell).padEnd(widths[index], pad)).join("  ");
  console.log(`  ${line(headers)}`);
  console.log(`  ${line(widths.map((width) => bar(width)), "─")}`);
  for (const row of rows) console.log(`  ${line(row)}`);
}

async function main() {
  console.log("\nOCADE — Python dependency install\n");

  if (!existsSync(PYTHON)) {
    console.error(`The engine's interpreter is missing:\n  ${PYTHON}\n`);
    console.error("Create it first, then run this again:");
    console.error("  python -m venv native/python-host/.venv\n");
    process.exitCode = 1;
    return;
  }

  const { out: version } = await run(PYTHON, ["--version"]);
  console.log(`  interpreter : ${PYTHON}`);
  console.log(`  version     : ${version.trim()}`);
  console.log(`  packages    : ${PACKAGES.length}\n`);

  const before = await survey();
  const wanted = FORCE ? PACKAGES : PACKAGES.filter((pkg) => !before.get(pkg.pip));

  if (CHECK_ONLY) {
    console.log("  --check: reporting only, nothing will be installed.\n");
  } else if (wanted.length === 0) {
    console.log("  Everything is already importable. Nothing to install.\n");
  } else {
    console.log(`  Installing ${wanted.length} package(s), quietly…\n`);
    // One pip invocation. Resolving the whole set together lets pip settle
    // shared transitive versions once, instead of letting a later package
    // silently downgrade a dependency an earlier one just pinned.
    const install = await run(PYTHON, [
      "-m",
      "pip",
      "install",
      "--quiet",
      "--disable-pip-version-check",
      ...(FORCE ? ["--force-reinstall"] : []),
      ...wanted.map((pkg) => pkg.pip),
    ]);
    if (install.code !== 0) {
      // Not fatal on its own. pip can fail on ONE package while installing the
      // rest, so the import survey below is what decides the outcome.
      console.log("  pip reported a problem; the per-package results are below.\n");
      const detail = install.out.trim().split(/\r?\n/).slice(-6).join("\n    ");
      if (detail) console.log(`    ${detail}\n`);
    }
  }

  const after = await survey();

  const rows = [];
  let ok = 0;
  let failed = 0;
  for (const pkg of PACKAGES) {
    const had = before.get(pkg.pip);
    const has = after.get(pkg.pip);
    let status;
    if (has && had) status = "ok";
    else if (has && !had) status = "INSTALLED";
    else status = "FAILED";
    if (has) ok++;
    else failed++;
    rows.push([
      pkg.pip,
      pkg.imports,
      status,
      GLOBAL_HOOKS.has(pkg.pip) ? `${pkg.why}  [global input hook]` : pkg.why,
    ]);
  }

  console.log();
  table(rows);

  const hooks = PACKAGES.filter((pkg) => GLOBAL_HOOKS.has(pkg.pip) && after.get(pkg.pip));
  console.log(`\n  ${ok}/${PACKAGES.length} importable` + (failed ? `, ${failed} FAILED` : ""));

  if (hooks.length > 0) {
    console.log(
      `\n  Note: ${hooks.map((pkg) => pkg.pip).join(", ")} install process-wide input hooks.\n` +
        "  They can observe all keyboard and mouse activity, not only OCADE's, and on\n" +
        "  Windows they need administrator rights to attach. No OCADE module imports\n" +
        "  them today — control goes through UI Automation, with pyautogui as the\n" +
        "  pointer fallback. They are installed because they were asked for.",
    );
  }

  if (failed > 0) {
    console.log(
      "\n  A FAILED row means the package is still not importable by the engine's\n" +
        "  interpreter, whatever pip reported. Re-run with --force to reinstall it.",
    );
    process.exitCode = 1;
  } else {
    console.log("\n  Every dependency is importable by the engine's interpreter.");
  }
  console.log();
}

await main();
