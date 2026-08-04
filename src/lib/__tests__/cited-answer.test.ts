import { describe, it, expect } from "vitest";
import { buildCitedAnswer, hasLocatableEvidence } from "../research/cited-answer";
import type { SourceRecord } from "../research/source-ranking";
import type { Claim } from "../research/claim-check";

const NOW = new Date("2026-07-23T12:00:00Z");

const source = (id: string, publisher: string, over: Partial<SourceRecord> = {}): SourceRecord => ({
  id,
  title: `${publisher} report`,
  publisher,
  kind: "news",
  publishedAt: new Date(NOW.getTime() - 20 * 60000),
  retrievedAt: NOW,
  ...over,
});

const claim = (over: Partial<Claim> = {}): Claim => ({
  text: "The council approved the new bridge over the river.",
  topic: "local government",
  supporting: [source("s1", "The Daily"), source("s2", "Evening Post")],
  ...over,
});

describe("attaching located citations to an assessed claim", () => {
  it("cites the passage that actually supports the claim, per source", () => {
    const texts = new Map([
      ["s1", "In a late session, the council approved the new bridge over the river yesterday."],
      ["s2", "Local officials confirmed the bridge decision after a long debate."],
    ]);
    const answer = buildCitedAnswer(claim(), texts, NOW);
    expect(answer.citations.length).toBeGreaterThanOrEqual(1);
    const daily = answer.citations.find((c) => c.publisher === "The Daily");
    expect(daily?.snippet).toContain("approved the new bridge");
    expect(daily?.matchedTerms).toContain("bridge");
  });

  /**
   * No passage, no citation: a supporting source whose text doesn't contain the
   * claim's terms is listed as without-evidence, never cited with an unrelated
   * excerpt.
   */
  it("lists a source without a matching passage rather than fabricating a citation", () => {
    const texts = new Map([
      ["s1", "The council approved the new bridge over the river."],
      ["s2", "This article is about an unrelated sports fixture entirely."],
    ]);
    const answer = buildCitedAnswer(claim(), texts, NOW);
    expect(answer.citations.map((c) => c.publisher)).toEqual(["The Daily"]);
    expect(answer.sourcesWithoutEvidence).toContain("Evening Post");
  });

  it("lists a source with no readable text as without-evidence", () => {
    const texts = new Map([["s1", "The council approved the new bridge."]]); // s2 absent
    const answer = buildCitedAnswer(claim(), texts, NOW);
    expect(answer.sourcesWithoutEvidence).toContain("Evening Post");
  });

  /**
   * A claim OCADE won't state (unsupported) yields NO citations — there is
   * nothing to cite for a claim it declined to assert.
   */
  it("produces no citations for an unsupported claim", () => {
    const answer = buildCitedAnswer(claim({ supporting: [] }), new Map(), NOW);
    expect(answer.assessment.confidence).toBe("unsupported");
    expect(answer.citations).toEqual([]);
  });

  it("produces no citations when sources disagree", () => {
    const texts = new Map([["s1", "The council approved the new bridge over the river."]]);
    const answer = buildCitedAnswer(
      claim({ contradicting: [source("against", "Council minutes")] }),
      texts,
      NOW,
    );
    expect(answer.assessment.confidence).toBe("contested");
    expect(answer.citations).toEqual([]);
  });

  it("does not cite syndicated copies as independent evidence", () => {
    const syndicated = claim({
      supporting: [
        source("s1", "The Daily", { originator: "Wire" }),
        source("s2", "Evening Post", { originator: "Wire" }),
      ],
    });
    const texts = new Map([
      ["s1", "The council approved the new bridge over the river."],
      ["s2", "The council approved the new bridge over the river."],
    ]);
    expect(buildCitedAnswer(syndicated, texts, NOW).citations).toHaveLength(1);
  });

  it("carries the assessment summary (confidence + caveats) through", () => {
    const texts = new Map([["s1", "The council approved the new bridge over the river."]]);
    const answer = buildCitedAnswer(claim({ supporting: [source("s1", "The Daily")] }), texts, NOW);
    expect(answer.summary).toMatch(/unconfirmed|source/i);
  });

  it("hasLocatableEvidence is a quick yes/no over the same logic", () => {
    expect(hasLocatableEvidence("the bridge was approved", "the bridge decision")).toBe(true);
    expect(hasLocatableEvidence("an unrelated topic", "the bridge decision")).toBe(false);
    expect(hasLocatableEvidence(undefined, "anything")).toBe(false);
  });
});
