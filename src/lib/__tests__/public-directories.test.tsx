import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Source with block and line comments removed, so a rule about visible copy is not tripped by an explanation of itself. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("truthful public directories", () => {
  it("renders a complete comparison matrix with pricing and product CTAs", () => {
    const source = readFileSync("src/routes/compare.tsx", "utf8");
    for (const value of [
      "Feature comparison table",
      "Key differentiators",
      "Compare planned pricing",
      "Create a free account",
    ])
      expect(source).toContain(value);
  });

  it("keeps status claims probe-bound and exposes incident, maintenance and update states", () => {
    const source = readFileSync("src/routes/status.tsx", "utf8");
    const catalogue = readFileSync("src/lib/status/catalogue.ts", "utf8");

    // The rows come from the catalogue and the checks it declares, so a row
    // asserting a state nothing measured has nowhere to live. Three of the four
    // rows on the page this replaced were exactly that.
    expect(source).toContain("STATUS_COMPONENTS");
    expect(source).toContain("probeAll");
    expect(catalogue).toContain("/api/health");

    for (const value of [
      "OCADE component status",
      "Incidents and uptime",
      "Scheduled maintenance",
      "separate status domain",
      "Machine-readable feed",
      "/api/public/status",
    ])
      expect(source).toContain(value);

    expect(source).toContain("no historical uptime percentage is claimed");
  });

  it("keeps the demo and a hard-coded launch date out of status copy", () => {
    /*
     * PLAN.md §K, and both were really there. The page pointed people at the
     * demo — deleted in this mission — to run an engine check, and printed
     * "The planned public launch remains 28 August 2026 at 8:28 AM
     * Asia/Kolkata", which is a hard-coded date, carries a time of day the
     * launch authority says must never appear in public copy, and was in the
     * past by the time anyone read it.
     */
    /*
     * Comments are stripped first. The rule is about what a VISITOR reads, and
     * the file's own history — written down so the next person does not
     * reintroduce either — necessarily names both things it must not print.
     * Scanning the raw source would make explaining the rule break it.
     */
    const source = withoutComments(readFileSync("src/routes/status.tsx", "utf8"));
    expect(source).not.toMatch(/\bdemo\b/i);
    expect(source).not.toMatch(/\b28 August 2026\b/);
    expect(source).not.toMatch(/Asia\/Kolkata/);
    expect(source).not.toMatch(/pre-?launch/i);
  });

  it("provides original press assets and a non-fictional team directory", () => {
    const press = readFileSync("src/routes/press.tsx", "utf8");
    const team = readFileSync("src/routes/team.tsx", "utf8");
    for (const value of [
      "Company overview",
      "Brand assets",
      "Key statistics",
      "Recent press releases",
      "Press contact",
    ])
      expect(press).toContain(value);
    for (const value of [
      "Founder and product leadership",
      "Areas of work",
      "Working character",
      "/careers",
    ])
      expect(team).toContain(value);
  });
});
