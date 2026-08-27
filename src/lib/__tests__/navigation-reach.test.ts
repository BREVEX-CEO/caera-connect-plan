import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODULE_CONTEXT, UTILITY } from "@/lib/shell-nav";

/**
 * The sidebar got shorter. Nothing got harder to find.
 *
 * Twelve entries became seven, and the risk of any such reduction is not that
 * it looks worse — it is that a screen quietly stops having a route to it and
 * nobody notices until a customer asks where their automations went. So this
 * enumerates the OCADE routes that actually exist and insists each one is
 * reachable: from the rail, from More, or from the command palette.
 */

const SYSTEM = readFileSync("src/routes/_authenticated/ocade.system.tsx", "utf8");
const PALETTE = readFileSync("src/components/shell/CommandPalette.tsx", "utf8");
const MOBILE = readFileSync("src/components/shell/OcadeMobileBottomNav.tsx", "utf8");

/** Every /ocade/* screen, read off the filesystem rather than a hand-kept list. */
function ocadeRoutes(): string[] {
  return (
    readdirSync("src/routes/_authenticated")
      // `ocade.tsx` is the layout that wraps them all, not a screen of its own.
      .filter((name) => name.startsWith("ocade.") && name.endsWith(".tsx") && name !== "ocade.tsx")
      .map((name) => name.replace(/^ocade\./, "").replace(/\.tsx$/, ""))
      .filter((slug) => slug !== "index" && !slug.includes("$"))
      .map((slug) => `/ocade/${slug.replace(/\./g, "/")}`)
  );
}

const RAIL = MODULE_CONTEXT.ocade.map((item) => item.to);

describe("the rail", () => {
  it("is seven entries", () => {
    expect(RAIL).toHaveLength(7);
  });

  it("is the set a person reaches for without deciding", () => {
    expect(RAIL).toEqual([
      "/ocade",
      "/ocade/work",
      "/ocade/projects",
      "/ocade/search",
      "/ocade/tasks",
      "/ocade/devices",
      "/ocade/system",
    ]);
  });

  it("ends in the door to everything else", () => {
    expect(MODULE_CONTEXT.ocade.at(-1)?.label).toBe("More");
  });
});

describe("nothing became unreachable", () => {
  it("routes every OCADE screen from the rail, More, or the palette", () => {
    const unreachable = ocadeRoutes().filter(
      (route) =>
        !RAIL.includes(route) && !SYSTEM.includes(`"${route}"`) && !PALETTE.includes(`"${route}"`),
    );
    expect(unreachable).toEqual([]);
  });

  it("lists the six screens that left the rail at the top of More", () => {
    /*
     * Position matters here and is worth asserting. Somebody who used
     * Automations yesterday and cannot find it today needs it above the fold,
     * not below Health.
     */
    const moved = [
      "/ocade/code",
      "/ocade/automations",
      "/ocade/artifacts",
      "/ocade/inbox",
      "/ocade/monitors",
      "/ocade/studio",
    ];
    const positions = moved.map((route) => SYSTEM.indexOf(`"${route}"`));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect(Math.max(...positions)).toBeLessThan(SYSTEM.indexOf('"/ocade/health"'));
  });
});

describe("mobile", () => {
  it("carries five of the seven, and keeps the rest one tap away", () => {
    expect(MOBILE).toContain('to: "/ocade/system"');
    for (const route of ["/ocade", "/ocade/projects", "/ocade/search", "/ocade/tasks"]) {
      expect(MOBILE).toContain(`to: "${route}"`);
    }
  });
});

describe("the utility rail", () => {
  it("still holds Devices and Settings", () => {
    expect(UTILITY.map((item) => item.id)).toEqual(["devices", "settings"]);
  });
});
