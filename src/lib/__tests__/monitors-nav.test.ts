import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { MODULE_CONTEXT } from "../shell-nav";

/**
 * The Monitors surface must be a reachable, distinct destination — the §5.3
 * world-scan feature wired into navigation, not an orphaned route.
 */
describe("the Monitors route is wired into navigation", () => {
  it("is reachable from OCADE, on the rail or under More", () => {
    /*
     * THIS USED TO REQUIRE A SIDEBAR ENTRY. The rail went from twelve
     * destinations to seven, which is the point of the change: a list of twelve
     * rooms is a sitemap, not a place to work. What must stay true is that the
     * screen has a route a person can follow — the rail, the More page, or the
     * command palette.
     */
    const onRail = MODULE_CONTEXT.ocade.some((item) => item.to === "/ocade/monitors");
    const underMore = readFileSync(
      "src/routes/_authenticated/ocade.customize.tsx",
      "utf8",
    ).includes('"/ocade/monitors"');
    const inPalette = readFileSync("src/components/shell/CommandPalette.tsx", "utf8").includes(
      '"/ocade/monitors"',
    );
    expect(onRail || underMore || inPalette).toBe(true);
  });

  it("does not collide with another destination", () => {
    const targets = MODULE_CONTEXT.ocade.map((i) => i.to);
    expect(new Set(targets).size).toBe(targets.length);
  });
});
