import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, chmod, rm, readFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * DEFECT BR-01. `browserPaths()` listed three Linux locations —
 * /usr/bin/google-chrome, -stable and /usr/bin/chromium — so a machine with
 * Chromium genuinely installed anywhere else was told "chrome is not installed
 * in a supported location". That covers neither of the two most ordinary Linux
 * installs: Ubuntu ships Chromium as a snap at /snap/bin/chromium, and Debian
 * and its derivatives name the binary chromium-browser. Windows had the same
 * hole for Chrome's per-user install under LOCALAPPDATA, which is what you get
 * whenever the installer runs without administrator rights.
 *
 * The host is a native-messaging entry point with no exports, so discovery is
 * exercised the way it actually runs: as a subprocess, through `--self-test`,
 * which reports what `detectBrowser()` resolved.
 */

const HOST = "native/browser-host/index.mjs";

function selfTest(env: NodeJS.ProcessEnv): Promise<{ chrome: string | null; edge: string | null }> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [HOST, "--self-test"],
      { env: { ...process.env, ...env }, timeout: 30_000 },
      (error, stdout) => {
        if (error) return reject(error);
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          reject(new Error(`self-test did not emit JSON: ${stdout}`));
        }
      },
    );
  });
}

describe("the browser host finds a browser that is genuinely installed", () => {
  it("honours OCADE_BROWSER_PATH, so an unlisted location is still reachable", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ocade-browser-"));
    try {
      const fake = join(dir, process.platform === "win32" ? "chrome.exe" : "chrome");
      if (process.platform === "win32") {
        await copyFile(process.execPath, fake);
      } else {
        await writeFile(fake, "#!/bin/sh\nexit 0\n", "utf8");
        await chmod(fake, 0o755);
      }

      const result = await selfTest({ OCADE_BROWSER_PATH: fake });
      expect(result.chrome).toBe(fake);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 40_000);

  it("does not accept a path that is not executable", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ocade-browser-"));
    try {
      const notExecutable = join(dir, process.platform === "win32" ? "chrome.exe" : "chrome");
      await writeFile(notExecutable, "not a browser", "utf8");
      await chmod(notExecutable, 0o644);

      const result = await selfTest({ OCADE_BROWSER_PATH: notExecutable });
      expect(result.chrome).not.toBe(notExecutable);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 40_000);

  /**
   * The specific locations the defect was missing. Asserted against the source
   * because they cannot all exist on any one machine — a test that only checked
   * this runner would pass while the Ubuntu and Debian paths stayed absent.
   */
  it("lists the Linux locations a real Chromium install actually uses", async () => {
    const source = await readFile(HOST, "utf8");
    for (const path of [
      "/usr/bin/chromium-browser", // Debian, Ubuntu and derivatives
      "/snap/bin/chromium", // Ubuntu's default Chromium
      "/opt/google/chrome/chrome", // Google's .deb/.rpm
    ]) {
      expect(source, `${path} is not among the candidates`).toContain(path);
    }
  });

  it("looks where Chrome installs itself without administrator rights", async () => {
    const source = await readFile(HOST, "utf8");
    // Per-user Chrome on Windows lives under LOCALAPPDATA.
    expect(source).toContain("LOCALAPPDATA");
    expect(source).toContain("Google/Chrome/Application/chrome.exe");
  });
});
