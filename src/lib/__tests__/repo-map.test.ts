import { describe, it, expect } from "vitest";
import { mapFile, buildRepoMap, findSymbol, importersOf, type SourceFile } from "../code/repo-map";

const FILE_A: SourceFile = {
  path: "src/lib/a.ts",
  content: [
    'import { helper } from "./b";',
    'import type { Thing } from "./types";',
    "",
    "export function run(x: number) {",
    "  return helper(x);",
    "}",
    "",
    "export const LIMIT = 10;",
    "export class Engine {}",
    "export type Result = { ok: boolean };",
    "export interface Options { verbose: boolean }",
  ].join("\n"),
};

const FILE_B: SourceFile = {
  path: "src/lib/b.ts",
  content: [
    'import { LIMIT } from "./a";',
    "export function helper(n: number) {",
    "  return n * LIMIT;",
    "}",
    "export default function main() {}",
  ].join("\n"),
};

function map(files: SourceFile[]) {
  const r = buildRepoMap(files);
  if (!r.ok) throw new Error(`fixture failed: ${r.reason}`);
  return r.data;
}

describe("mapping a file", () => {
  it("finds every kind of top-level export with its line", () => {
    const m = mapFile(FILE_A);
    expect(m.parsed).toBe(true);
    expect(m.exports).toEqual([
      { name: "run", kind: "function", line: 4 },
      { name: "LIMIT", kind: "const", line: 8 },
      { name: "Engine", kind: "class", line: 9 },
      { name: "Result", kind: "type", line: 10 },
      { name: "Options", kind: "interface", line: 11 },
    ]);
  });

  it("records imports, including type-only ones", () => {
    expect(mapFile(FILE_A).imports).toEqual(["./b", "./types"]);
  });

  it("reads a default export", () => {
    const def = mapFile(FILE_B).exports.find((e) => e.kind === "default");
    expect(def).toEqual({ name: "main", kind: "default", line: 5 });
  });

  it("reads an export list with aliases", () => {
    const m = mapFile({
      path: "x.ts",
      content: "const a = 1;\nconst b = 2;\nexport { a, b as renamed };",
    });
    expect(m.exports.map((e) => e.name)).toEqual(["a", "renamed"]);
  });

  /**
   * The false-symbol trap: `export` inside a comment or a string is not a
   * declaration, and inventing a symbol from it would send an agent editing
   * around something that doesn't exist.
   */
  it("does not invent symbols from comments or strings", () => {
    const tricky: SourceFile = {
      path: "c.ts",
      content: [
        "// export function ghost() {}",
        "/* export const alsoGhost = 1; */",
        'const doc = "export class StringGhost {}";',
        "export const real = 1;",
      ].join("\n"),
    };
    const m = mapFile(tricky);
    expect(m.exports.map((e) => e.name)).toEqual(["real"]);
  });

  it("handles a multi-line block comment containing export", () => {
    const m = mapFile({
      path: "d.ts",
      content: [
        "/*",
        " export function hidden() {}",
        " still comment",
        "*/",
        "export const shown = 1;",
      ].join("\n"),
    });
    expect(m.exports.map((e) => e.name)).toEqual(["shown"]);
  });

  /**
   * The rule that matters most: a non-source file is UNPARSED, not empty. An
   * agent must be able to tell "this exports nothing" from "OCADE couldn't read
   * this".
   */
  it("marks a non-source file unparsed rather than empty", () => {
    const m = mapFile({ path: "README.md", content: "# Title\nexport is an English word here." });
    expect(m.parsed).toBe(false);
    expect(m.exports).toEqual([]);
  });
});

describe("building the repo map", () => {
  it("aggregates files, exports, and unparsed count", () => {
    const m = map([FILE_A, FILE_B, { path: "notes.md", content: "hi" }]);
    expect(m.totalFiles).toBe(3);
    expect(m.parsedFiles).toBe(2);
    expect(m.totalExports).toBe(7);
    expect(m.unparsed).toEqual(["notes.md"]);
  });

  it("says in its evidence when some files weren't source", () => {
    const r = buildRepoMap([FILE_A, { path: "x.md", content: "" }]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/1 not source OCADE reads/);
  });

  it("refuses a duplicated path rather than double-counting", () => {
    const r = buildRepoMap([FILE_A, FILE_A]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/supplied twice/i);
  });

  it("refuses an empty file set", () => {
    expect(buildRepoMap([]).ok).toBe(false);
  });
});

describe("symbol search is exact by default", () => {
  const m = map([FILE_A, FILE_B]);

  it("finds an exact match and reports where it is", () => {
    const r = findSymbol(m, "run");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toEqual([
      { path: "src/lib/a.ts", symbol: { name: "run", kind: "function", line: 4 } },
    ]);
  });

  /**
   * Searching for `run` must NOT return `runStep`, `rerun`, etc. and leave the
   * agent to guess which is meant.
   */
  it("does not return near-misses in exact mode", () => {
    const withNoise = map([
      FILE_A,
      { path: "n.ts", content: "export function runStep() {}\nexport const rerun = 1;" },
    ]);
    const r = findSymbol(withNoise, "run");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.map((h) => h.symbol.name)).toEqual(["run"]);
    expect(r.evidence).toMatch(/1 exact match/);
  });

  it("offers fuzzy search explicitly, and labels it", () => {
    const withNoise = map([
      FILE_A,
      { path: "n.ts", content: "export function runStep() {}\nexport const rerun = 1;" },
    ]);
    const r = findSymbol(withNoise, "run", { fuzzy: true });
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.map((h) => h.symbol.name).sort()).toEqual(["rerun", "run", "runStep"]);
    expect(r.evidence).toMatch(/fuzzy match/);
  });

  it("suggests fuzzy when an exact search finds nothing", () => {
    const r = findSymbol(m, "runn");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toEqual([]);
    expect(r.evidence).toMatch(/Try a fuzzy search/i);
  });

  it("refuses an empty query", () => {
    expect(findSymbol(m, "  ").ok).toBe(false);
  });
});

describe("dependency lookups report only edges actually seen", () => {
  const m = map([FILE_A, FILE_B]);

  it("finds which files import a module", () => {
    const r = importersOf(m, "./a");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toEqual(["src/lib/b.ts"]);
  });

  it("reports honestly when nothing imports it", () => {
    const r = importersOf(m, "./nonexistent");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toEqual([]);
    expect(r.evidence).toMatch(/Nothing in the mapped files imports/);
  });

  it("does not count an unparsed file as importing nothing", () => {
    // The .md file is unparsed; it must not appear as a non-importer that
    // "definitely" doesn't depend on ./a.
    const withDoc = map([FILE_A, FILE_B, { path: "x.md", content: 'import "./a"' }]);
    const r = importersOf(withDoc, "./a");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toEqual(["src/lib/b.ts"]);
  });

  it("refuses an empty specifier", () => {
    expect(importersOf(m, "").ok).toBe(false);
  });
});
