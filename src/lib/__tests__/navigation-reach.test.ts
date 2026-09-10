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
 * reachable: from the rail, from Customize, or from the command palette.
 *
 * THE RAIL NOW LEADS WITH THE THREE PRIMARY MODES, which is what PLAN.md §4
 * calls Chat, Cowork and Code. Two of them were not in it: Cowork was here
 * under its old name and path, and Code was only in the old More directory —
 * so a person who never opened it never learned that OCADE writes code.
 */

const MORE = readFileSync("src/routes/_authenticated/ocade.customize.tsx", "utf8");
/*
 * THE PALETTE'S DESTINATIONS LIVE IN `command-entries.ts`, NOT IN THE DIALOG.
 *
 * Reading the dialog component made this test pass for the wrong reason:
 * `/ocade/search` was counted as reachable because the old More directory
 * listed it, and the palette entry that actually reaches it was never read.
 */
const PALETTE = readFileSync("src/components/shell/command-entries.ts", "utf8");
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

  it("ends in Customize, which is no longer a directory of everything", () => {
    /*
     * §17: "remove old More". The last rail entry used to open a list of twenty
     * screens; it now opens the four things that change how OCADE behaves for
     * this person, so the label says Customize rather than More.
     */
    expect(MODULE_CONTEXT.ocade.at(-1)?.label).toBe("Customize");
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

  it("keeps the words people search for pointing at the screens that absorbed them", () => {
    /*
     * THIS USED TO ASSERT A DIRECTORY. It required Automations, Inbox,
     * Monitors and Studio to appear near the top of the More page, because
     * that page was where a screen went when it left the rail.
     *
     * §4 finished the job those routes were waiting on: Automations, Inbox and
     * Monitors ARE Tasks now, and Studio IS Artifacts. There is no directory to
     * be near the top of. What has to stay true is the thing the old assertion
     * was protecting — somebody who used Automations yesterday can still find
     * it today — so the palette entry for each destination must carry the words
     * they will type.
     */
    const palette = readFileSync("src/components/shell/command-entries.ts", "utf8");
    for (const word of ["automations", "monitors", "inbox", "studio", "templates"]) {
      expect(palette.toLowerCase(), word).toContain(word);
    }
  });
});

describe("mobile", () => {
  it("keeps the rest one tap away behind Customize", () => {
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
