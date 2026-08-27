/**
 * RUN THE WHOLE WINDOWS PROOF, ON A REAL WINDOWS PC, WITH ONE COMMAND.
 *
 * Everything in this repository that needs Windows has a harness written for
 * it, and none of those harnesses has ever executed: the audit environment is a
 * Linux container with no virtualisation, and this account's GitHub Actions
 * runners do not start. So the Windows-specific claims in the final report are
 * marked unproven, and they stay that way until this runs somewhere real.
 *
 * This is that somewhere. It refuses to run anywhere but Windows — a "proof"
 * that quietly degrades on the wrong platform is worse than no proof — locates
 * the REAL Chrome Stable rather than a bundled Chromium, runs every Windows
 * harness end to end, and writes a timestamped evidence file recording what
 * passed, what refused, and on what hardware.
 *
 *   npm run windows:prove
 *
 * What it covers:
 *   1. The sidecar's protocol and its honest refusals (any platform).
 *   2. Reply correlation, successes and refusals alike.
 *   3. The full Python suite, with the Windows paths EXECUTING rather than
 *      skipping — window placement, per-platform voice, the perception paths.
 *   4. Real PC control: pointer, keyboard, OCR, window and app control, the
 *      STOP latch, request ids, protected-input refusal.
 *   5. Cowork against real Chrome Stable: the extension E2E and CDP parity.
 */
import { execFileSync, execFileSync as run } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EOL } from "node:os";

const PYTHON_HOST = join(process.cwd(), "native", "python-host");
const CONTROL_ENGINE = join(process.cwd(), "native", "ocade_control_engine");
const npmCli =
  process.env.npm_execpath ??
  join(process.execPath, "..", "node_modules", "npm", "bin", "npm-cli.js");

if (process.platform !== "win32") {
  console.error(
    `This proof only means anything on Windows, and this is ${process.platform}.${EOL}` +
      `It drives a real pointer, a real keyboard and the OCR engine built into Windows.${EOL}` +
      `Run it from a Windows PC: npm run windows:prove`,
  );
  process.exit(1);
}

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Locate the real Chrome Stable. A bundled Chromium is not what is claimed. */
function findChrome() {
  const candidates = [
    join(process.env["ProgramFiles"] ?? "", "Google/Chrome/Application/chrome.exe"),
    join(process.env["ProgramFiles(x86)"] ?? "", "Google/Chrome/Application/chrome.exe"),
    join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
  ];
  return candidates.find((c) => c && existsSync(c)) ?? null;
}

/**
 * Official Chrome branded builds no longer honour --load-extension (Chrome
 * 137+). Chrome for Testing and Chromium remain the supported automation
 * targets, so extension E2E must use one of those rather than silently waiting
 * for a worker that branded Chrome will never install.
 */
function findExtensionTestBrowser() {
  const explicit = process.env.OCADE_EXTENSION_TEST_BROWSER;
  if (explicit && existsSync(explicit)) return explicit;

  const candidates = [
    join(process.env.LOCALAPPDATA ?? "", "Google/Chrome for Testing/Application/chrome.exe"),
    join(process.env["ProgramFiles"] ?? "", "Google/Chrome for Testing/Application/chrome.exe"),
  ];

  const playwrightRoot = join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  if (existsSync(playwrightRoot)) {
    for (const entry of readdirSync(playwrightRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("chromium-")) continue;
      candidates.push(join(playwrightRoot, entry.name, "chrome-win64", "chrome.exe"));
    }
  }

  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

function stage(name, command, args, options = {}) {
  process.stdout.write(`${EOL}── ${name}${EOL}`);
  try {
    const output = run(command, args, {
      stdio: "pipe",
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      ...options,
    });
    process.stdout.write(output);
    record(name, true, (output.trim().split(/\r?\n/).at(-1) ?? "").slice(0, 120));
    return output;
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    process.stdout.write(output);
    record(name, false, (output.trim().split(/\r?\n/).at(-1) ?? error.message).slice(0, 200));
    return output;
  }
}

const python = process.env.PYTHON ?? "python";
let windowsVersion = "unknown";
try {
  windowsVersion = execFileSync("cmd", ["/c", "ver"], { encoding: "utf8" }).trim();
} catch {
  /* reported as unknown rather than guessed */
}

console.log(`OCADE Windows proof${EOL}  ${windowsVersion}${EOL}  node ${process.version}`);

const chrome = findChrome();
const extensionTestBrowser = findExtensionTestBrowser();
if (chrome) {
  let version = "";
  try {
    version = execFileSync("powershell", [
      "-NoProfile",
      "-Command",
      `(Get-Item '${chrome}').VersionInfo.ProductVersion`,
    ])
      .toString()
      .trim();
  } catch {
    /* the path is what matters; the version is a nicety */
  }
  record("real Chrome Stable is installed", true, `${chrome}${version ? ` (${version})` : ""}`);
} else {
  // Not fatal for the Python stages, but the Cowork stages below cannot run,
  // and they are recorded as failures rather than skipped silently.
  record("real Chrome Stable is installed", false, "no chrome.exe in any standard location");
}
if (extensionTestBrowser) {
  let version = "";
  try {
    version = execFileSync("powershell", [
      "-NoProfile",
      "-Command",
      `(Get-Item '${extensionTestBrowser}').VersionInfo.ProductVersion`,
    ])
      .toString()
      .trim();
  } catch {
    /* the executable path remains usable evidence */
  }
  record(
    "Chrome for Testing or Chromium is installed",
    true,
    `${extensionTestBrowser}${version ? ` (${version})` : ""}`,
  );
} else {
  record(
    "Chrome for Testing or Chromium is installed",
    false,
    "required because Chrome Stable 137+ refuses command-line unpacked extensions",
  );
}

// ---- Python -----------------------------------------------------------------
stage("install the sidecar's pinned dependencies", python, [
  "-m",
  "pip",
  "install",
  "--quiet",
  "-r",
  join(PYTHON_HOST, "requirements.txt"),
  "pytest",
]);

stage(
  "the sidecar speaks its protocol and refuses honestly",
  python,
  ["-m", "pytest", "tests/test_sidecar_protocol_e2e.py", "tests/test_request_correlation.py", "-q"],
  { cwd: PYTHON_HOST },
);

stage(
  "the full sidecar suite, with the Windows paths executing",
  python,
  ["-m", "pytest", "tests/", "-q", "-rs"],
  { cwd: PYTHON_HOST },
);

stage(
  "REAL PC CONTROL: pointer, keyboard, OCR, windows, STOP latch",
  python,
  ["-m", "pytest", "tests/test_windows_control_e2e.py", "-q", "-rs"],
  { cwd: PYTHON_HOST },
);

stage("control engine suite", python, ["-m", "pytest", "core/", "-q"], { cwd: CONTROL_ENGINE });

// ---- Cowork and managed-browser parity ---------------------------------------
if (extensionTestBrowser) {
  const withTestBrowser = {
    env: { ...process.env, OCADE_BROWSER_PATH: extensionTestBrowser },
  };
  stage(
    "extension manifest and safety gate",
    process.execPath,
    [npmCli, "run", "extension:check"],
    {
      ...withTestBrowser,
    },
  );
  stage(
    "COWORK extension against Chrome for Testing",
    process.execPath,
    [npmCli, "run", "extension:e2e"],
    {
      ...withTestBrowser,
    },
  );
}
if (chrome) {
  const withChrome = { env: { ...process.env, OCADE_BROWSER_PATH: chrome } };
  stage(
    "Chrome and Edge parity through the managed host",
    process.execPath,
    [npmCli, "run", "browser:cdp-parity"],
    {
      ...withChrome,
    },
  );
}

// ---- Evidence ---------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
const evidence = {
  recordedAt: new Date().toISOString(),
  platform: `${process.platform} ${process.arch}`,
  windowsVersion,
  node: process.version,
  chrome,
  extensionTestBrowser,
  passed: results.length - failed.length,
  total: results.length,
  results,
};
const path = join(process.cwd(), "release", "OCADE_WINDOWS_PROOF_EVIDENCE.json");
writeFileSync(path, JSON.stringify(evidence, null, 2));

console.log(
  `${EOL}${results.length - failed.length}/${results.length} stages passed${EOL}` +
    `evidence written to ${path}`,
);
if (failed.length) {
  console.log(`${EOL}FAILED STAGES:${EOL}  ${failed.map((f) => f.name).join(`${EOL}  `)}`);
  process.exitCode = 1;
}
