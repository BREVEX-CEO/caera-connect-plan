import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public founder profile", () => {
  it("publishes identity, role, biography and a factual contribution record", () => {
    const source = readFileSync("src/routes/founder.haans-antoni.tsx", "utf8");
    for (const value of [
      "HAANS ANTONI initials",
      "CEO, Chairman and Founder",
      "Contribution record",
      "Founder record · 28 August 2026",
      "Created and directs OCADE",
      "Public profile scope",
    ])
      expect(source).toContain(value);
    expect(source).toContain("does not expose an OCADE user profile");
    expect(source).toContain("visibility");
  });
});
