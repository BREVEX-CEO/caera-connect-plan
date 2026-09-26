import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * OCADE IS A WEBSITE THAT CAN BE ADDED TO A HOME SCREEN, AND NEVER NAGS.
 *
 * Updated by the owner's 2026-09-26 decision: Android, iPhone and iPad are
 * website/PWA-first with Add to Home Screen. What still holds from the earlier
 * decision is below the manifest tests: no install prompt, no install copy.
 *
 * The owner's decision, and it is narrower than "we have no install button":
 * the product had none, and Chrome offered to install it anyway. A web app
 * manifest with `display: standalone` IS the install offer — it puts an install
 * control in the address bar and in the browser menu without a line of product
 * code. `apple-touch-icon` does the same job for "Add to Home Screen" on iOS.
 *
 * So the thing to keep out is the manifest, not a button, and a button is what
 * a reviewer would look for. This looks for what actually causes it.
 *
 * WHAT THIS MUST NOT BREAK: the service worker. Offline caching and
 * installability are separate browser features that appear in the same
 * tutorials, and deleting the manifest changes nothing about whether the shell
 * opens without a connection. The last assertion here holds that line — if
 * somebody removes `sw.js` believing it to be part of the install story, this
 * fails and says so.
 */

/** Comments explain why something is absent, so they name it. Match code. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const ROOT = code("src/routes/__root.tsx");

/** Every source file except this one, which necessarily names what it forbids. */
function productSources(roots: string[], extensions: RegExp): string[] {
  return roots
    .flatMap((root) => walk(root))
    .filter((path) => extensions.test(path) && !path.endsWith("ocade-is-a-website.test.ts"));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

describe("OCADE is a website", () => {
  it("can be added to a home screen, opening a route that exists", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    expect(ROOT).toMatch(/rel:\s*"manifest"/);
    expect(manifest.start_url).toBe("/ocade-jarvis");
    expect(existsSync("src/routes/ocade-jarvis.tsx")).toBe(true);
    for (const icon of manifest.icons) expect(existsSync(`public${icon.src}`)).toBe(true);
    expect(existsSync("public/apple-touch-icon.png")).toBe(true);
  });

  it("never listens for the browser's install prompt", () => {
    const offending = productSources(["src", "public"], /\.(ts|tsx|js|html)$/).filter((path) =>
      /beforeinstallprompt|appinstalled/i.test(code(path)),
    );
    expect(offending).toEqual([]);
  });

  it("promotes no app to download, install or add to a home screen", () => {
    // Product copy only. `installation-authority.ts` and its neighbours install
    // the OFFLINE MODEL, which is a download inside the website rather than an
    // app, so the phrases below are chosen to not match it.
    const wording =
      /install (the )?(app|ocade as|our app)|add to home screen|download the app|desktop app|app store|play store/i;
    const offending = productSources(["src"], /\.(ts|tsx)$/).filter((path) =>
      wording.test(code(path)),
    );
    expect(offending).toEqual([]);
  });

  it("still ships the service worker, which is a different thing entirely", () => {
    expect(existsSync("public/sw.js")).toBe(true);
    expect(existsSync("public/offline.html")).toBe(true);
    expect(ROOT).toContain('serviceWorker.register("/sw.js"');
  });
});
