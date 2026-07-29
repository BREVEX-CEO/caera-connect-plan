import { describe, it, expect } from "vitest";
import { findReferences } from "../code/references";
import type { SourceFile } from "../code/repo-map";

const file = (path: string, content: string): SourceFile => ({ path, content });

describe("finding references to a symbol", () => {
  it("finds a definition and separates it from uses", () => {
    const files = [
      file("a.ts", "export function run() {\n  return 1;\n}"),
      file("b.ts", 'import { run } from "./a";\nrun();\nconst x = run() + 1;'),
    ];
    const r = findReferences(files, "run");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.definitions).toHaveLength(1);
    expect(r.data.definitions[0].path).toBe("a.ts");
    // import line + two use lines in b.ts.
    expect(r.data.references.map((x) => `${x.path}:${x.line}`)).toEqual([
      "b.ts:1",
      "b.ts:2",
      "b.ts:3",
    ]);
  });

  /** Whole-identifier only: `run` must not match `rerun` or `runner`. */
  it("matches whole identifiers, not substrings", () => {
    const r = findReferences(
      [file("a.ts", "const rerun = 1;\nconst runner = 2;\nfoo(run);")],
      "run",
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.references).toHaveLength(1);
    expect(r.data.references[0].line).toBe(3);
  });

  /** A name inside a comment or string is not a code reference. */
  it("ignores matches in line comments, block comments, and strings", () => {
    const files = [
      file(
        "a.ts",
        [
          "// run this later",
          "/* run in a block",
          "   run again */",
          'const msg = "please run now";',
          "const t = `run ${x}`;",
          "actuallyRun(run);",
        ].join("\n"),
      ),
    ];
    const r = findReferences(files, "run");
    if (!r.ok) throw new Error("unreachable");
    // Only the last line has a real code reference.
    expect(r.data.references).toHaveLength(1);
    expect(r.data.references[0].line).toBe(6);
  });

  it("does not match a property access of the same name", () => {
    const r = findReferences([file("a.ts", "obj.run();\nrun();")], "run");
    if (!r.ok) throw new Error("unreachable");
    // `obj.run` is a different symbol; only the bare `run()` counts.
    expect(r.data.references).toHaveLength(1);
    expect(r.data.references[0].line).toBe(2);
  });

  it("recognises each declaration keyword", () => {
    for (const decl of [
      "export function run() {}",
      "class run {}",
      "const run = 1;",
      "type run = string;",
      "interface run {}",
      "enum run {}",
    ]) {
      const r = findReferences([file("a.ts", decl)], "run");
      if (!r.ok) throw new Error("unreachable");
      expect(r.data.definitions, decl).toHaveLength(1);
    }
  });

  /**
   * The honest framing: results are textual and labelled as such, because a
   * text search can't tell the symbol from an unrelated identifier.
   */
  it("labels results as textual, warning they may be unrelated", () => {
    const r = findReferences([file("a.ts", "run();")], "run");
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/text matches/i);
    expect(r.evidence).toMatch(/unrelated identifier of the same name/i);
  });

  /** A non-source file is skipped and listed, never scanned as empty. */
  it("skips non-source files and lists them", () => {
    const r = findReferences(
      [file("readme.md", "run the app with npm run"), file("a.ts", "run();")],
      "run",
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.skipped).toEqual(["readme.md"]);
    expect(r.data.references).toHaveLength(1);
  });

  it("reports honestly when nothing is found", () => {
    const r = findReferences([file("a.ts", "const x = 1;")], "run");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.references).toHaveLength(0);
    expect(r.data.definitions).toHaveLength(0);
    expect(r.evidence).toMatch(/No textual reference/i);
  });

  it("rejects an invalid identifier", () => {
    expect(findReferences([file("a.ts", "x")], "not an identifier").ok).toBe(false);
    expect(findReferences([file("a.ts", "x")], "").ok).toBe(false);
  });

  it("handles a block comment that spans into code on the same line", () => {
    const r = findReferences([file("a.ts", "/* comment */ run();")], "run");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.references).toHaveLength(1);
  });
});
