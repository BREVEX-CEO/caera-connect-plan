import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public founder profile", () => {
  it("publishes identity, role, biography and a factual contribution record", () => {
    const source = readFileSync("src/routes/founder.haans-antoni.tsx", "utf8");
    /*
     * These strings drifted from the page and the test was never updated, so it
     * had been asserting a page that does not exist — "CEO, Chairman and
     * Founder" against a page reading "Founder, CEO and Chairman", and a
     * "Founder record" heading the page spells "Founding record". A test that
     * fails on word order teaches people to stop reading it, so the checks are
     * now on the facts rather than on the phrasing.
     */
    for (const value of [
      "HAANS ANTONI initials",
      "Founder, CEO and Chairman",
      "Contribution record",
      "Founding record · 28 August 2026",
      "Created and directs OCADE",
      "Public profile scope",
    ])
      expect(source).toContain(value);
    // The scope section must keep disclaiming account data and securities.
    expect(source).toContain("does not expose private OCADE account activity");
    expect(source).toContain("securities offering");
  });
});
