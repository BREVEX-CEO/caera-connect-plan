import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

function installedPlaywrightBrowsers() {
  const root = process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "ms-playwright")
    : "";
  if (!root || !existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("chromium-"))
    .sort((left, right) => right.name.localeCompare(left.name, undefined, { numeric: true }))
    .flatMap((entry) => [
      join(root, entry.name, "chrome-win64", "chrome.exe"),
      join(root, entry.name, "chrome-win", "chrome.exe"),
    ]);
}

/** Resolve a Chromium-family browser on developer machines and CI runners. */
export function resolveBrowserPath() {
  const candidates = [
    process.env.OCADE_BROWSER_PATH,
    ...installedPlaywrightBrowsers(),
    process.env.PROGRAMFILES
      ? join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe")
      : "",
    process.env["PROGRAMFILES(X86)"]
      ? join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe")
      : "",
    process.env.PROGRAMFILES
      ? join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe")
      : "",
    process.env["PROGRAMFILES(X86)"]
      ? join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe")
      : "",
    "/opt/pw-browsers/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);

  const executablePath = candidates.find((candidate) => existsSync(candidate));
  if (executablePath) return executablePath;

  throw new Error(
    "No Chromium-family browser was found. Install Playwright Chromium, Chrome, or Edge, or set OCADE_BROWSER_PATH.",
  );
}
