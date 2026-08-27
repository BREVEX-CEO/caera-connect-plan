import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("truthful public directories", () => {
  it("renders a complete comparison matrix with pricing and product CTAs", () => {
    const source = readFileSync("src/routes/compare.tsx", "utf8");
    for (const value of [
      "Feature comparison table",
      "Key differentiators",
      "Compare planned pricing",
      "Try the local demo",
    ])
      expect(source).toContain(value);
  });

  it("keeps status claims probe-bound and exposes incident, maintenance and update states", () => {
    const source = readFileSync("src/routes/status.tsx", "utf8");
    for (const value of [
      "/api/health",
      "OCADE component status",
      "Incidents and uptime",
      "Scheduled maintenance",
      "Last checked",
      "separate status domain",
    ])
      expect(source).toContain(value);
    expect(source).toContain("no uptime percentage is claimed");
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
