import { describe, it, expect } from "vitest";
import { parseUnifiedDiff, applyPatch, applyReversibly, buildPatchReceipt } from "../code/patch";

/**
 * Real unified diffs against real file contents.
 *
 * The round-trip property is the backbone: for every patch that applies,
 * applying its inverse must reproduce the original byte for byte. That single
 * property catches offset errors, newline handling and hunk-ordering bugs that
 * individual assertions miss.
 */

const FILE = ["function greet(name) {", '  return "hi " + name;', "}", ""].join("\n");

const DIFF = [
  "--- a/greet.js",
  "+++ b/greet.js",
  "@@ -1,3 +1,3 @@",
  " function greet(name) {",
  '-  return "hi " + name;',
  "+  return `Hello, ${name}`;",
  " }",
  "",
].join("\n");

function parse(text: string) {
  const r = parseUnifiedDiff(text);
  if (!r.ok) throw new Error(`fixture failed: ${r.reason}`);
  return r.data;
}

describe("parsing a unified diff", () => {
  it("reads the path and hunks", () => {
    const p = parse(DIFF);
    expect(p.path).toBe("greet.js");
    expect(p.hunks).toHaveLength(1);
    expect(p.hunks[0].oldStart).toBe(1);
    expect(p.hunks[0].ops.filter((o) => o.kind === "add")).toHaveLength(1);
  });

  it("reports what it will change before changing it", () => {
    const r = parseUnifiedDiff(DIFF);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toBe("1 hunk, 2 changed lines, in greet.js.");
  });

  /**
   * A header whose counts disagree with its body is a corrupted or hand-edited
   * diff. Applying it silently shifts everything after the hunk.
   */
  it("catches a hunk header that lies about its size", () => {
    const lying = DIFF.replace("@@ -1,3 +1,3 @@", "@@ -1,5 +1,3 @@");
    const r = parseUnifiedDiff(lying);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/would shift everything after it/i);
  });

  it("handles single-line hunks, where the count is omitted", () => {
    const single = ["--- a/x", "+++ b/x", "@@ -2 +2 @@", "-old", "+new", ""].join("\n");
    const p = parse(single);
    expect(p.hunks[0].oldLines).toBe(1);
    expect(p.hunks[0].newLines).toBe(1);
  });

  it("ignores the no-newline marker", () => {
    const marked = DIFF.replace(" }", " }\n\\ No newline at end of file");
    expect(parseUnifiedDiff(marked).ok).toBe(true);
  });

  it("refuses a patch with no file header or no changes", () => {
    expect(parseUnifiedDiff("@@ -1,1 +1,1 @@\n-a\n+b").ok).toBe(false);
    expect(parseUnifiedDiff("--- a/x\n+++ b/x\n").ok).toBe(false);
    expect(parseUnifiedDiff("").ok).toBe(false);
  });

  it("refuses a line it doesn't understand rather than skipping it", () => {
    const junk = DIFF.replace('-  return "hi " + name;', '?  return "hi " + name;');
    expect(parseUnifiedDiff(junk).ok).toBe(false);
  });
});

describe("applying a patch", () => {
  it("produces the expected file", () => {
    const r = applyPatch(FILE, parse(DIFF));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.content).toBe(
      ["function greet(name) {", "  return `Hello, ${name}`;", "}", ""].join("\n"),
    );
    expect(r.data.linesAdded).toBe(1);
    expect(r.data.linesRemoved).toBe(1);
  });

  it("preserves the absence of a trailing newline", () => {
    const noNewline = FILE.trimEnd();
    const r = applyPatch(noNewline, parse(DIFF));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.content.endsWith("\n")).toBe(false);
  });

  it("preserves CRLF endings through apply and exercised undo", () => {
    const crlf = FILE.replace(/\n/g, "\r\n");
    const applied = applyReversibly(crlf, parse(DIFF));
    if (!applied.ok) throw new Error(applied.reason);
    expect(applied.data.content).toContain("\r\n");
    expect(applied.data.content.replace(/\r\n/g, "")).not.toContain("\n");
    const undone = applyPatch(applied.data.content, applied.data.inverse);
    if (!undone.ok) throw new Error(undone.reason);
    expect(undone.data.content).toBe(crlf);
  });

  it("refuses mixed line endings rather than normalizing bytes silently", () => {
    const mixed = FILE.replace("\n", "\r\n");
    const result = applyPatch(mixed, parse(DIFF));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/mixed or unsupported line endings/i);
  });

  it("applies several hunks in one pass", () => {
    const file = ["a", "b", "c", "d", "e", ""].join("\n");
    const diff = [
      "--- a/x",
      "+++ b/x",
      "@@ -1,2 +1,2 @@",
      "-a",
      "+A",
      " b",
      "@@ -4,2 +4,2 @@",
      " d",
      "-e",
      "+E",
      "",
    ].join("\n");
    const r = applyPatch(file, parse(diff));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.content).toBe(["A", "b", "c", "d", "E", ""].join("\n"));
  });

  it("handles pure insertion and pure deletion", () => {
    const file = ["a", "b", ""].join("\n");
    const insert = ["--- a/x", "+++ b/x", "@@ -1,2 +1,3 @@", " a", "+new", " b", ""].join("\n");
    const del = ["--- a/x", "+++ b/x", "@@ -1,2 +1,1 @@", "-a", " b", ""].join("\n");

    const i = applyPatch(file, parse(insert));
    const d = applyPatch(file, parse(del));
    if (!i.ok || !d.ok) throw new Error("unreachable");
    expect(i.data.content).toBe(["a", "new", "b", ""].join("\n"));
    expect(d.data.content).toBe(["b", ""].join("\n"));
  });
});

/**
 * The rule the whole module exists for. Fuzzy application is enormously
 * convenient and is how an edit lands in the wrong function — the file still
 * compiles and the diff still looks right in review.
 */
describe("a patch is refused rather than fuzzed", () => {
  it("REFUSES when the context has changed, and writes nothing", () => {
    const changed = FILE.replace('  return "hi " + name;', '  return "hello " + name;');
    const r = applyPatch(changed, parse(DIFF));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/doesn't match what this patch expects/i);
    expect(r.reason).toMatch(/edit lands in the wrong place/i);
    expect(r.reason).toMatch(/Nothing was written/i);
  });

  it("shows both the expected and the found line, so it can be fixed", () => {
    const changed = FILE.replace("function greet(name) {", "function greet(name){");
    const r = applyPatch(changed, parse(DIFF));
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/expected: "function greet\(name\) \{"/);
    expect(r.reason).toMatch(/found: {4}"function greet\(name\)\{"/);
  });

  /** Whitespace-only drift is exactly the case fuzzy matchers wave through. */
  it("refuses on a whitespace-only difference", () => {
    const reindented = FILE.replace('  return "hi " + name;', '    return "hi " + name;');
    expect(applyPatch(reindented, parse(DIFF)).ok).toBe(false);
  });

  it("refuses when the file is shorter than the patch expects", () => {
    const r = applyPatch("function greet(name) {\n", parse(DIFF));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/the file ends at line/i);
  });

  it("refuses a hunk starting past the end of the file", () => {
    const diff = ["--- a/x", "+++ b/x", "@@ -50,1 +50,1 @@", "-a", "+b", ""].join("\n");
    const r = applyPatch("short\n", parse(diff));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/has only 1 lines/i);
  });

  it("refuses hunks that are out of order", () => {
    const file = ["a", "b", "c", "d", ""].join("\n");
    const diff = [
      "--- a/x",
      "+++ b/x",
      "@@ -3,1 +3,1 @@",
      "-c",
      "+C",
      "@@ -1,1 +1,1 @@",
      "-a",
      "+A",
      "",
    ].join("\n");
    const r = applyPatch(file, parse(diff));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/out of order/i);
  });
});

/**
 * An undo that is merely derived is not an undo that works, and the difference
 * only shows up when someone needs it.
 */
describe("every change is proven reversible before it counts", () => {
  it("round-trips back to the original, byte for byte", () => {
    const r = applyReversibly(FILE, parse(DIFF));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    const undone = applyPatch(r.data.content, r.data.inverse);
    if (!undone.ok) throw new Error("unreachable");
    expect(undone.data.content).toBe(FILE);
    expect(r.evidence).toMatch(/reproduces the original byte for byte/i);
  });

  it("round-trips across many shapes of patch", () => {
    const cases: [string, string][] = [
      [
        ["a", "b", "c", ""].join("\n"),
        ["--- a/x", "+++ b/x", "@@ -1,1 +1,2 @@", " a", "+inserted", ""].join("\n"),
      ],
      [
        ["a", "b", "c", ""].join("\n"),
        ["--- a/x", "+++ b/x", "@@ -2,1 +2,0 @@", "-b", ""].join("\n"),
      ],
      [
        ["a", "b", "c", "d", "e", ""].join("\n"),
        [
          "--- a/x",
          "+++ b/x",
          "@@ -1,1 +1,1 @@",
          "-a",
          "+A",
          "@@ -5,1 +5,1 @@",
          "-e",
          "+E",
          "",
        ].join("\n"),
      ],
      [
        ["one", "two", "three", ""].join("\n"),
        [
          "--- a/x",
          "+++ b/x",
          "@@ -1,3 +1,4 @@",
          "-one",
          "+ONE",
          "+extra",
          " two",
          " three",
          "",
        ].join("\n"),
      ],
    ];

    for (const [file, diff] of cases) {
      const applied = applyReversibly(file, parse(diff));
      expect(applied.ok, diff).toBe(true);
      if (!applied.ok) throw new Error("unreachable");
      const undone = applyPatch(applied.data.content, applied.data.inverse);
      if (!undone.ok) throw new Error(`undo failed: ${undone.reason}`);
      expect(undone.data.content, diff).toBe(file);
    }
  });

  it("round-trips a file with no trailing newline", () => {
    const applied = applyReversibly(FILE.trimEnd(), parse(DIFF));
    if (!applied.ok) throw new Error("unreachable");
    const undone = applyPatch(applied.data.content, applied.data.inverse);
    if (!undone.ok) throw new Error("unreachable");
    expect(undone.data.content).toBe(FILE.trimEnd());
  });

  it("carries a refusal through instead of applying unreversibly", () => {
    const changed = FILE.replace('  return "hi " + name;', "  // gone");
    expect(applyReversibly(changed, parse(DIFF)).ok).toBe(false);
  });
});

describe("the receipt", () => {
  it("states what changed and that the undo was exercised", () => {
    const r = applyReversibly(FILE, parse(DIFF));
    if (!r.ok) throw new Error("unreachable");
    const receipt = buildPatchReceipt(parse(DIFF), r.data, true);
    expect(receipt.evidence).toBe("greet.js: +1 −1 across 1 hunk, undo verified.");
    expect(receipt.undoVerified).toBe(true);
  });

  /**
   * A receipt that claimed the undo worked without exercising it would be the
   * false-success failure this project exists to avoid.
   */
  it("marks an unexercised undo as NOT CONFIRMED", () => {
    const r = applyPatch(FILE, parse(DIFF));
    if (!r.ok) throw new Error("unreachable");
    const receipt = buildPatchReceipt(parse(DIFF), r.data, false);
    expect(receipt.evidence).toMatch(/^greet\.js: \+1 −1/);
    expect(receipt.evidence).toMatch(/NOT CONFIRMED: the undo was produced but never exercised/);
    expect(receipt.undoVerified).toBe(false);
  });
});
