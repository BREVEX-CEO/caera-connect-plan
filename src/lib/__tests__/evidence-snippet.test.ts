import { describe, it, expect } from "vitest";
import { extractSnippet } from "../research/evidence-snippet";

const SOURCE = [
  "The city council met on Tuesday to discuss the transport budget.",
  "After a long debate, the council approved the new bridge over the river.",
  "Funding will come from the regional infrastructure fund next year.",
].join("\n");

describe("finding the supporting passage", () => {
  it("returns a verbatim passage containing the terms", () => {
    const r = extractSnippet(SOURCE, ["bridge", "approved"]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.text).toContain("approved the new bridge");
    // The snippet must be an exact substring of the source.
    expect(SOURCE).toContain(r.data.text);
    expect(r.data.matchedTerms.sort()).toEqual(["approved", "bridge"]);
  });

  it("reports the line the passage starts on", () => {
    const r = extractSnippet(SOURCE, ["bridge"]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.line).toBe(2);
  });

  it("reports the character offset, and it points at the real text", () => {
    const r = extractSnippet(SOURCE, ["infrastructure"]);
    if (!r.ok) throw new Error("unreachable");
    expect(SOURCE.slice(r.data.offset)).toContain("infrastructure");
  });

  /**
   * Density of DISTINCT terms wins, so a window covering two different terms
   * beats one repeating a single term.
   */
  it("prefers the window covering the most distinct terms", () => {
    const text = "budget budget budget. Here the council approved the bridge funding clearly.";
    const r = extractSnippet(text, ["council", "bridge", "funding"], { windowChars: 60 });
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.matchedTerms.length).toBeGreaterThanOrEqual(2);
    expect(r.data.text).toMatch(/council|bridge|funding/);
  });

  it("matches whole words only, not substrings", () => {
    // "bridgehead" must not match the term "bridge".
    const r = extractSnippet("The bridgehead was fortified overnight.", ["bridge"]);
    expect(r.ok).toBe(false);
  });

  it("is case-insensitive", () => {
    const r = extractSnippet("The COUNCIL Approved it.", ["council", "approved"]);
    expect(r.ok).toBe(true);
  });
});

/**
 * The rule the module exists for: no supporting passage → no snippet. Never
 * return an unrelated excerpt as though it were evidence.
 */
describe("it refuses to fabricate a citation", () => {
  it("refuses when none of the terms appear in the source", () => {
    const r = extractSnippet(SOURCE, ["submarine", "volcano"]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't quote an unrelated excerpt as evidence/i);
  });

  it("refuses an empty source", () => {
    expect(extractSnippet("   ", ["anything"]).ok).toBe(false);
  });

  it("refuses when no usable terms are given", () => {
    expect(extractSnippet(SOURCE, ["", "a"]).ok).toBe(false);
    expect(extractSnippet(SOURCE, []).ok).toBe(false);
  });

  it("handles regex-special characters in terms without crashing", () => {
    const r = extractSnippet("The rate is 5.5% this year.", ["5.5%"]);
    // Whether or not it matches, it must not throw and must be a clean outcome.
    expect(typeof r.ok).toBe("boolean");
  });
});
