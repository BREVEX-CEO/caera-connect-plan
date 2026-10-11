import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The donor ZIPs and their extracted snapshot were removed from the repository
 * (11 October 2026, PLAN.md Section 0.4; manifest in ToRemove.md). OCADE owns
 * its runtime: nothing active may read, package or import donor material again.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === "build" || name === "__pycache__") return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const DONOR = /imports[\\/]ocade-jarvis|UI OCADE JARVIS\.zip|ocade jarvis 25-09|source-original/;

describe("no donor material", () => {
  it("is in the repository", () => {
    expect(existsSync("imports")).toBe(false);
  });

  it("is referenced by any active source, build or packaging file", () => {
    const active = ["src", "jarvis-runtime", "android", "scripts", "supabase"]
      .flatMap(files)
      .filter((path) => !path.endsWith("no-donor-runtime.test.ts"))
      .filter((path) =>
        /\.(ts|tsx|mts|mjs|js|json|py|java|ps1|sh|spec|sql|xml|txt|toml)$/.test(path),
      );
    const config = [".prettierignore", ".gitattributes", "eslint.config.js", "package.json"];
    const offenders = [...active, ...config].filter((path) =>
      DONOR.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

describe("the working runtime", () => {
  const runtime = files("jarvis-runtime").filter((path) => path.endsWith(".py"));

  it("reads no provider key from local configuration", () => {
    const offenders = runtime.filter((path) =>
      /gemini_api_key|elevenlabs_api_key|api_keys\.json|save_api_keys|x-goog-api-key|xi-api-key/.test(
        readFileSync(path, "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("no longer carries the old desktop GUI or its direct provider session", () => {
    const names = files("jarvis-runtime").map((path) =>
      relative("jarvis-runtime", path).replace(/\\/g, "/"),
    );
    for (const retired of [
      "ui.py",
      "main.py",
      "core/avatar.py",
      "core/avatar_mesh.py",
      "core/llm_client.py",
    ]) {
      expect(names).not.toContain(retired);
    }
    expect(names).toContain("ocade_device.py");
  });

  it("carries its capabilities in the modules the agent runs", () => {
    for (const kept of [
      "actions/browser_control.py",
      "ocade_computer.py",
      "ocade_settings.py",
      "ocade_documents.py",
      "ocade_sheets.py",
      "ocade_accessibility.py",
      "ocade_existing_browser.py",
      "ocade_wake.py",
    ]) {
      expect(statSync(join("jarvis-runtime", kept)).isFile()).toBe(true);
    }
  });
});
