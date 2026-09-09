import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

/**
 * THE GATE THAT KEEPS ORDINARY CONTENT OUT OF THE BROWSER — PLAN.md Phase 2.
 *
 * A gate nobody tests is a gate that quietly stops matching. These run the real
 * script against small scratch trees, so what is proved is what it will do to
 * the repository: it catches a new content store, it does not cry about the
 * device preferences that are meant to be there, and it cannot be satisfied by
 * a comment or by a string that merely mentions storage.
 */

const scratch = mkdtempSync(join(tmpdir(), "ocade-content-storage-"));
const gate = resolve("scripts/check-content-storage.mjs");

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

let treeCount = 0;
function tree(files: Record<string, string>) {
  treeCount += 1;
  const root = join(scratch, `tree-${treeCount}`);
  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
}

function runGate(root: string) {
  const result = spawnSync(process.execPath, [gate, `--root=${root}`], {
    encoding: "utf8",
    shell: false,
  });
  // Findings go to stderr, which is where a failing gate belongs; the summary
  // line goes to stdout. Joined here so a test asserts on what a person reads.
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe("it catches a new browser store", () => {
  it("fails on localStorage in a file that is not a declared device store", () => {
    const root = tree({
      "src/lib/notes.ts": 'export const save = (t: string) => localStorage.setItem("notes", t);',
    });
    const result = runGate(root);
    expect(result.status).toBe(1);
    expect(result.output).toContain("src/lib/notes.ts uses localStorage");
  });

  it("catches sessionStorage, IndexedDB, Cache Storage and OPFS too", () => {
    // All four are places a second copy of somebody's work has actually ended
    // up in this codebase, so all four are watched.
    const root = tree({
      "src/a.ts": 'export const a = () => sessionStorage.getItem("x");',
      "src/b.ts": 'export const b = () => indexedDB.open("ocade");',
      "src/c.ts": 'export const c = () => caches.open("ocade");',
      "src/d.ts": "export const d = () => navigator.storage.getDirectory();",
    });
    const result = runGate(root);
    expect(result.status).toBe(1);
    for (const kind of ["sessionStorage", "indexedDB", "caches", "OPFS"]) {
      expect(result.output).toContain(kind);
    }
  });
});

describe("what it deliberately does not flag", () => {
  it("passes a declared device store", () => {
    const root = tree({
      "src/lib/theme-provider.tsx": 'export const t = () => localStorage.getItem("theme");',
    });
    const result = runGate(root);
    expect(result.status).toBe(0);
  });

  it("passes a file that does not touch storage at all", () => {
    const root = tree({ "src/lib/pure.ts": "export const add = (a: number) => a + 1;" });
    expect(runGate(root).status).toBe(0);
  });

  it("ignores tests, which stand storage up on purpose", () => {
    // A test that writes to a fake store is proving something about the code,
    // not shipping a second content authority.
    const root = tree({
      "src/lib/__tests__/thing.test.ts": 'localStorage.setItem("x", "y");',
      "src/lib/other.test.ts": 'localStorage.setItem("x", "y");',
    });
    expect(runGate(root).status).toBe(0);
  });
});

describe("it cannot be satisfied by prose", () => {
  it("does not fire on a COMMENT that mentions storage", () => {
    const root = tree({
      "src/lib/documented.ts": [
        "// This used to keep conversations in localStorage.",
        "/* It also used indexedDB and caches.open at one point. */",
        "export const nothing = 1;",
      ].join("\n"),
    });
    expect(runGate(root).status).toBe(0);
  });

  it("does not fire on a STRING that mentions storage", () => {
    const root = tree({
      "src/lib/copy.ts": 'export const message = "We no longer use localStorage for your chats.";',
    });
    expect(runGate(root).status).toBe(0);
  });

  it("STILL fires on real code sitting beside that prose", () => {
    /*
     * The check that keeps the two above honest. Blanking comments and strings
     * must not blank the code between them — a stripper that was slightly too
     * greedy would make this gate silently pass everything.
     */
    const root = tree({
      "src/lib/mixed.ts": [
        "// A note about localStorage.",
        'export const label = "localStorage";',
        'export const save = (t: string) => localStorage.setItem("notes", t);',
      ].join("\n"),
    });
    const result = runGate(root);
    expect(result.status).toBe(1);
    expect(result.output).toContain("src/lib/mixed.ts uses localStorage");
  });
});

describe("the real repository", () => {
  it("has no ordinary content in browser storage, and no stale allowance", () => {
    /*
     * The gate run for real. It also fails on an allowance for a file that no
     * longer touches storage, so the list stays a set of decisions somebody
     * made rather than a graveyard nobody reads.
     */
    const result = spawnSync(process.execPath, [gate], { encoding: "utf8", shell: false });
    expect(result.stderr, result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No content in browser storage");
  });
});
