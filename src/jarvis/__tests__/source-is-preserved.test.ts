import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The uploaded JARVIS ZIP and its extracted snapshot are provenance: never
 * edited, formatted, debloated or upgraded. The ZIP is pinned by hash, and the
 * snapshot must match, file for file, the manifest read from that ZIP.
 */
const ZIP = "imports/ocade-jarvis/ocade jarvis 25-09.zip";
const ZIP_SHA256 = "07be657ca2f0ba4665b27deac6a1779cf42db477d6a01cfae3b94ee4f90ca9e0";
const SNAPSHOT = "imports/ocade-jarvis/source-original";
const MANIFEST = "imports/ocade-jarvis/source-original.sha256";

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("the original JARVIS source", () => {
  it("keeps the uploaded ZIP byte for byte", () => {
    expect(sha256(ZIP)).toBe(ZIP_SHA256);
  });

  it("keeps the latest UI reference ZIP byte for byte", () => {
    expect(sha256("imports/UI OCADE JARVIS.zip")).toBe(
      "dfd6ba4154be014a02858aefbfd6086fa57c44dc7ca78ec7c6293516c149266b",
    );
  });

  it("keeps the extracted snapshot identical to the ZIP's contents", () => {
    const expected = new Map(
      readFileSync(MANIFEST, "utf8")
        .trim()
        .split(/\r?\n/)
        .map((line) => [line.slice(66), line.slice(0, 64)] as const),
    );
    const actual = new Map(
      files(SNAPSHOT).map((path) => [relative(SNAPSHOT, path).replace(/\\/g, "/"), sha256(path)]),
    );
    expect(expected.size).toBe(58);
    expect(actual).toEqual(expected);
  });

  it("is excluded from formatting and lint autofix", () => {
    expect(readFileSync(".prettierignore", "utf8")).toContain(
      "imports/ocade-jarvis/source-original/",
    );
    expect(readFileSync("eslint.config.js", "utf8")).toContain(
      "imports/ocade-jarvis/source-original/**",
    );
    expect(readFileSync(".gitattributes", "utf8")).toContain(
      "imports/ocade-jarvis/source-original/** -text",
    );
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

  /*
   * The donor's capabilities live on where the agent runs them
   * (docs/DONOR_CAPABILITY_LEDGER.md); the originals stay in the snapshot above.
   */
  it("carries the adapted capabilities in the modules the agent runs", () => {
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
    for (const original of [
      "actions/computer_control.py",
      "actions/file_controller.py",
      "actions/screen_processor.py",
      "actions/dev_agent.py",
      "core/undo.py",
      "core/wake_word.py",
    ]) {
      expect(statSync(join(SNAPSHOT, "ocade jarvis 25-09", original)).isFile()).toBe(true);
    }
  });
});
