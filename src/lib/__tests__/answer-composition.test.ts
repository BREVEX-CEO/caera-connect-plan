import { describe, it, expect } from "vitest";
import { validateClaim, composeAnswer, renderAnswer, type Claim } from "../chat/answer-composition";

const claim = (over: Partial<Claim> = {}): Claim => ({
  kind: "observation",
  text: "The build output shows 3 warnings.",
  ...over,
});

describe("claim labelling is enforced", () => {
  it("accepts a well-formed observation", () => {
    expect(validateClaim(claim()).ok).toBe(true);
  });

  /**
   * A fact with no source is an inference wearing a fact's clothes — the exact
   * mislabelling that makes a hunch look load-bearing.
   */
  it("rejects a retrieved fact with no source", () => {
    const r = validateClaim(
      claim({ kind: "retrieved_fact", text: "The API rate limit is 100/min" }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/inference in disguise/i);
  });

  it("accepts a retrieved fact that cites a source", () => {
    expect(
      validateClaim({
        kind: "retrieved_fact",
        text: "Rate limit is 100/min",
        source: "api docs v3",
      }).ok,
    ).toBe(true);
  });

  /** "The price is X" without "as of when" is a claim that quietly rots. */
  it("rejects a time-sensitive claim with no timestamp", () => {
    const r = validateClaim(claim({ text: "The price is $42", timeSensitive: true }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/quietly goes stale/i);
  });

  it("accepts a time-sensitive claim with a timestamp", () => {
    expect(
      validateClaim(
        claim({ text: "The price is $42", timeSensitive: true, asOf: "2026-07-24T10:00:00Z" }),
      ).ok,
    ).toBe(true);
  });

  it("rejects an unreadable timestamp", () => {
    expect(validateClaim(claim({ asOf: "yesterday-ish" })).ok).toBe(false);
  });

  it("rejects an empty claim", () => {
    expect(validateClaim(claim({ text: "  " })).ok).toBe(false);
  });
});

describe("composing an answer", () => {
  it("counts claims by kind and reports the shape", () => {
    const r = composeAnswer([
      claim({ kind: "observation", text: "Tests failed on step 4." }),
      { kind: "retrieved_fact", text: "The framework requires Node 20", source: "readme" },
      { kind: "inference", text: "The failure is likely a version mismatch." },
      { kind: "recommendation", text: "Upgrade Node to 20." },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.breakdown.observation).toBe(1);
    expect(r.data.breakdown.inference).toBe(1);
    expect(r.data.grounded).toBe(true);
  });

  it("rejects the whole answer if one claim is mislabelled", () => {
    const r = composeAnswer([
      claim(),
      { kind: "retrieved_fact", text: "uncited claim" }, // no source
    ]);
    expect(r.ok).toBe(false);
  });

  /**
   * A recommendation resting on nothing observed or cited is an opinion. The
   * answer is allowed, but that fact is surfaced rather than hidden.
   */
  it("surfaces a recommendation that rests on no ground", () => {
    const r = composeAnswer([
      { kind: "inference", text: "This might be flaky." },
      { kind: "recommendation", text: "Add a retry." },
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.grounded).toBe(false);
    expect(r.evidence).toMatch(/rests on reasoning alone/i);
  });

  it("collects the time-sensitive claims", () => {
    const r = composeAnswer([
      claim(),
      {
        kind: "retrieved_fact",
        text: "Price $42",
        source: "market",
        timeSensitive: true,
        asOf: "2026-07-24T10:00:00Z",
      },
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.timeSensitive).toHaveLength(1);
  });

  it("refuses an empty answer", () => {
    expect(composeAnswer([]).ok).toBe(false);
  });
});

describe("rendering keeps the kinds visibly separate", () => {
  it("prefixes each claim with its kind, so a hunch never looks like a fact", () => {
    const r = composeAnswer([
      { kind: "observation", text: "Log shows a timeout." },
      { kind: "inference", text: "The server may be overloaded." },
      { kind: "retrieved_fact", text: "Default timeout is 30s", source: "docs" },
    ]);
    if (!r.ok) throw new Error("unreachable");
    const out = renderAnswer(r.data);
    expect(out).toMatch(/^Observed: Log shows a timeout\./m);
    expect(out).toMatch(/^Inference: The server may be overloaded\./m);
    expect(out).toMatch(/^Fact: Default timeout is 30s \[docs\]/m);
  });

  it("shows the timestamp on a time-sensitive claim", () => {
    const r = composeAnswer([
      {
        kind: "retrieved_fact",
        text: "Price $42",
        source: "market",
        timeSensitive: true,
        asOf: "2026-07-24T10:00:00Z",
      },
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(renderAnswer(r.data)).toMatch(/as of 2026-07-24T10:00:00Z/);
  });
});
