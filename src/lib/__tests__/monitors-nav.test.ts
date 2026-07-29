import { describe, it, expect } from "vitest";
import { MODULE_CONTEXT } from "../shell-nav";

/**
 * The Monitors surface must be a reachable, distinct destination — the §5.3
 * world-scan feature wired into navigation, not an orphaned route.
 */
describe("the Monitors route is wired into navigation", () => {
  it("has its own distinct OCADE nav entry", () => {
    const entry = MODULE_CONTEXT.ocade.find((i) => i.label === "Monitors");
    expect(entry).toBeDefined();
    expect(entry!.to).toBe("/ocade/monitors");
    expect(entry!.planned).toBeUndefined();
  });

  it("does not collide with another destination", () => {
    const targets = MODULE_CONTEXT.ocade.map((i) => i.to);
    expect(new Set(targets).size).toBe(targets.length);
  });
});
