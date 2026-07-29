import { describe, it, expect } from "vitest";
import { shadowApplyPatch, SHADOW_RULE } from "../skills/shadow-execution";
import { parseUnifiedDiff } from "../code/patch";

const FILE = ["function greet(name) {", '  return "hi " + name;', "}", ""].join("\n");

const GOOD_DIFF = [
  "--- a/greet.js",
  "+++ b/greet.js",
  "@@ -1,3 +1,3 @@",
  " function greet(name) {",
  '-  return "hi " + name;',
  "+  return `Hello, ${name}`;",
  " }",
  "",
].join("\n");

function patch(text: string) {
  const r = parseUnifiedDiff(text);
  if (!r.ok) throw new Error(`fixture failed: ${r.reason}`);
  return r.data;
}

describe("a change is proven on a copy first", () => {
  it("blesses a change whose result satisfies its postconditions", () => {
    const r = shadowApplyPatch(FILE, patch(GOOD_DIFF), {
      mustContain: ["Hello, ${name}"],
      mustNotContain: ['"hi " + name'],
      mustChange: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.safeToApply).toBe(true);
    expect(r.data.failures).toEqual([]);
    expect(r.evidence).toMatch(/Safe to apply, and reversible/);
  });

  /**
   * The point of postconditions: a patch can apply cleanly and still be wrong.
   * A change that was supposed to remove the old string but didn't is caught
   * before the real file is touched.
   */
  it("holds back a change that applied but didn't achieve its goal", () => {
    // This patch adds a line but leaves the old return in place.
    const additive = [
      "--- a/greet.js",
      "+++ b/greet.js",
      "@@ -1,3 +1,4 @@",
      " function greet(name) {",
      '+  console.log("greeting");',
      '   return "hi " + name;',
      " }",
      "",
    ].join("\n");
    const r = shadowApplyPatch(FILE, patch(additive), {
      mustNotContain: ['"hi " + name'], // expected the old return to be gone
    });
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.safeToApply).toBe(false);
    expect(r.data.failures[0]).toMatch(/should no longer contain/i);
  });

  it("holds back a change missing something it should contain", () => {
    const r = shadowApplyPatch(FILE, patch(GOOD_DIFF), {
      mustContain: ["completely absent string"],
    });
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.safeToApply).toBe(false);
    expect(r.data.failures[0]).toMatch(/should contain/i);
  });

  it("enforces a size bound", () => {
    const r = shadowApplyPatch(FILE, patch(GOOD_DIFF), { maxBytes: 10 });
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.safeToApply).toBe(false);
    expect(r.data.failures[0]).toMatch(/over the 10-byte limit/);
  });

  /**
   * When the patch itself doesn't apply, the real file is safe by construction
   * — nothing was ever attempted against it — and the preview stays the
   * original.
   */
  it("leaves the real file untouched when the patch doesn't apply", () => {
    const changed = FILE.replace('"hi " + name', '"hello " + name');
    const r = shadowApplyPatch(changed, patch(GOOD_DIFF), {});
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.safeToApply).toBe(false);
    expect(r.data.preview).toBe(changed); // unchanged
    expect(r.data.failures[0]).toMatch(/doesn't apply cleanly/i);
    expect(r.evidence).toMatch(/real file was never touched/i);
  });

  it("does not mutate the input content", () => {
    const before = FILE;
    shadowApplyPatch(FILE, patch(GOOD_DIFF), { mustContain: ["Hello"] });
    expect(FILE).toBe(before);
  });

  it("reports the line delta of the shadow", () => {
    const r = shadowApplyPatch(FILE, patch(GOOD_DIFF), {});
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.linesAdded).toBe(1);
    expect(r.data.linesRemoved).toBe(1);
  });

  it("catches a no-op change when the caller expected a change", () => {
    // A patch that replaces a line with itself: applies, but changes nothing
    // meaningful. mustChange catches the case where that wasn't intended.
    const noop = ["--- a/x", "+++ b/x", "@@ -1,1 +1,1 @@", "-same", "+same", ""].join("\n");
    const r = shadowApplyPatch("same\n", patch(noop), { mustChange: true });
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.safeToApply).toBe(false);
    expect(r.data.failures[0]).toMatch(/made no difference/i);
  });
});

describe("the rule is stated for callers", () => {
  it("says a failed shadow leaves the real file exactly as it was", () => {
    expect(SHADOW_RULE).toMatch(/left exactly as it was/i);
    expect(SHADOW_RULE).toMatch(/does not apply a change it couldn't prove correct/i);
  });
});
