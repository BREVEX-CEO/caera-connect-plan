import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODULE_CONTEXT, UTILITY } from "@/lib/shell-nav";
import { ROUTE_DISPOSITIONS } from "@/lib/release/route-dispositions";

/**
 * The sidebar got shorter. Nothing got harder to find.
 *
 * Twelve entries became seven, and the risk of any such reduction is not that
 * it looks worse — it is that a screen quietly stops having a route to it and
 * nobody notices until a customer asks where their automations went. So this
 * enumerates the OCADE routes that actually exist and insists each one is
 * reachable: from the rail, from More, or from the command palette.
 *
 * THE RAIL NOW LEADS WITH THE THREE PRIMARY MODES, which is what PLAN.md §4
 * calls Chat, Cowork and Code. Two of them were not in it: Cowork was here
 * under its old name and path, and Code was only in More — so a person who
 * never opened More never learned that OCADE writes code.
 */

const MORE = readFileSync("src/routes/_authenticated/ocade.customize.tsx", "utf8");
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

  it("leads with PLAN §4's three primary modes, then its secondary views", () => {
    expect(RAIL).toEqual([
      "/ocade",
      "/ocade/cowork",
      "/ocade/code",
      "/ocade/projects",
      "/ocade/tasks",
      "/ocade/artifacts",
      "/ocade/customize",
    ]);
  });

  it("does not spend an entry on Search, which is an overlay", () => {
    /*
     * §4: "Search into a global overlay and contextual search." Cmd/Ctrl+K
     * opens it from every screen, so a rail entry would be a second way to do
     * the same thing, one keystroke slower — and it would cost the rail a slot
     * that a primary mode needs.
     */
    expect(RAIL).not.toContain("/ocade/search");
    expect(PALETTE.length).toBeGreaterThan(500);
  });

  it("ends in the door to everything else", () => {
    expect(MODULE_CONTEXT.ocade.at(-1)?.label).toBe("More");
  });
});

describe("nothing became unreachable", () => {
  it("routes every OCADE screen from the rail, More, or the palette", () => {
    /*
     * A FORWARDING ADDRESS IS NOT A SCREEN. `/ocade/work` and `/ocade/system`
     * are `MIGRATE` in the route ledger: they redirect in `beforeLoad` and
     * never render, so a navigation entry pointing at one would send somebody
     * through a redirect to reach a place the rail already lists directly.
     *
     * Read from the ledger rather than listed here, so a route that stops being
     * a redirect immediately becomes something this test insists is reachable.
     */
    const redirects = new Set(
      ROUTE_DISPOSITIONS.filter((entry) => entry.disposition === "MIGRATE").map(
        (entry) => entry.path,
      ),
    );
    const unreachable = ocadeRoutes().filter(
      (route) =>
        !redirects.has(route) &&
        !RAIL.includes(route) &&
        !MORE.includes(`"${route}"`) &&
        !PALETTE.includes(`"${route}"`),
    );
    expect(unreachable).toEqual([]);
  });

  it("lists the screens that left the rail at the top of More", () => {
    /*
     * Position matters here and is worth asserting. Somebody who used
     * Automations yesterday and cannot find it today needs it above the fold,
     * not below Health.
     */
    const moved = ["/ocade/automations", "/ocade/inbox", "/ocade/monitors", "/ocade/studio"];
    const positions = moved.map((route) => MORE.indexOf(`"${route}"`));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect(Math.max(...positions)).toBeLessThan(MORE.indexOf('"/ocade/health"'));
  });
});

describe("mobile", () => {
  it("keeps the rest one tap away behind More", () => {
    expect(MOBILE).toContain('to: "/ocade/customize"');
    for (const route of ["/ocade", "/ocade/projects", "/ocade/tasks"]) {
      expect(MOBILE).toContain(`to: "${route}"`);
    }
  });
});

describe("the utility rail", () => {
  it("still holds Devices and Settings", () => {
    expect(UTILITY.map((item) => item.id)).toEqual(["devices", "settings"]);
  });
});
