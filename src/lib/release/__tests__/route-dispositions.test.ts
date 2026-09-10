import { existsSync, globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_ROUTES,
  ROUTE_DISPOSITIONS,
  unservedCanonicalRoutes,
  validateRouteLedger,
} from "../route-dispositions";

/**
 * THE ROUTE LEDGER, CHECKED AGAINST THE ROUTES THAT ACTUALLY EXIST.
 *
 * PLAN.md §4 ends with "Generate a route-disposition ledger", and a ledger
 * nobody compares to the repository is a document. This is the comparison, and
 * it fails in both directions: a route on disk with no entry means somebody
 * added a screen without deciding where it belongs, and an entry with no module
 * means a migration looks finished when the screen it names is gone.
 *
 * It also asserts the thing the ledger was written to find: every canonical
 * route §4's table names is served by something.
 */

/** Every route module in the repository, as the ledger names them. */
function modulesOnDisk(): string[] {
  return globSync("src/routes/**/*.{ts,tsx}")
    .filter((file) => !file.includes("__tests__"))
    .map((file) =>
      file
        .replace(/\\/g, "/")
        .replace(/^src\/routes\//, "")
        .replace(/\.(ts|tsx)$/, ""),
    )
    .sort();
}

describe("the route-disposition ledger", () => {
  it("found routes to check against, so an empty glob cannot pass", () => {
    expect(modulesOnDisk().length).toBeGreaterThan(50);
    expect(ROUTE_DISPOSITIONS.length).toBeGreaterThan(50);
  });

  it("accounts for every route, and every entry is a real route", () => {
    expect(validateRouteLedger(modulesOnDisk())).toEqual([]);
  });

  it("serves every canonical route PLAN.md §4 names", () => {
    // There is no exception list. There was one entry in it — `/organization`,
    // tracked as ORG-001 — and finishing that gap is what deleting it looked
    // like. A list that grows back is a plan being abandoned one route at a
    // time, so the assertion is now unconditional.
    const served = new Set(ROUTE_DISPOSITIONS.map((entry) => entry.path.replace(/\/$/, "")));
    for (const [area, path] of Object.entries(CANONICAL_ROUTES)) {
      expect([...served], `${area} (${path})`).toContain(path.replace(/\/$/, ""));
    }
  });

  it("agrees with the checker that nothing canonical is unserved", () => {
    expect(unservedCanonicalRoutes()).toEqual([]);
  });

  it("names the three primary modes as canonical, not as something else", () => {
    // §4 calls Chat, Cowork and Code the primary modes. A primary mode that is
    // only reachable through a redirect is not primary.
    for (const path of ["/ocade", "/ocade/cowork", "/ocade/code"]) {
      const entry = ROUTE_DISPOSITIONS.find((candidate) => candidate.path === path);
      expect(entry?.disposition, path).toBe("CANONICAL");
    }
  });

  it("sends every migrated route somewhere that exists", () => {
    const paths = new Set(ROUTE_DISPOSITIONS.map((entry) => entry.path));
    for (const entry of ROUTE_DISPOSITIONS) {
      if (entry.disposition !== "MIGRATE" && entry.disposition !== "ABSORB") continue;
      expect(entry.movesTo, entry.module).toBeTruthy();
      expect([...paths], `${entry.module} → ${entry.movesTo}`).toContain(entry.movesTo);
    }
  });

  it("actually forwards every migrated route, rather than planning to", () => {
    /*
     * THE GATE THAT MAKES A DISPOSITION MEAN SOMETHING.
     *
     * For most of this mission `MIGRATE` was an intention: fifteen routes were
     * marked as moving into Chat, Tasks, Artifacts, Settings or Customize, and
     * fifteen full screens were still shipping at the old addresses. The rail
     * had shrunk, so they read as consolidated — but the command palette still
     * listed them, the bundle still carried them, and each was a second place
     * the same data could be shown and disagree.
     *
     * So the ledger is now checked against the module on disk. A route that
     * says it moved must be a `beforeLoad` redirect to where it says it moved
     * — `beforeLoad`, because a component that navigates in an effect renders
     * the old screen first, and a prefetch, a crawler and a screen reader all
     * see it.
     */
    const problems: string[] = [];
    for (const entry of ROUTE_DISPOSITIONS) {
      if (entry.disposition !== "MIGRATE" && entry.disposition !== "ABSORB") continue;
      const file = `src/routes/${entry.module}.tsx`;
      if (!existsSync(file)) {
        problems.push(`${entry.module}: no module on disk`);
        continue;
      }
      const source = readFileSync(file, "utf8");
      if (!source.includes("beforeLoad")) {
        problems.push(`${entry.module}: still renders a screen at ${entry.path}`);
        continue;
      }
      if (!source.includes(`to: "${entry.movesTo}"`)) {
        problems.push(`${entry.module}: does not forward to ${entry.movesTo}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("has retired the demo entirely, which §5 requires", () => {
    expect(ROUTE_DISPOSITIONS.filter((entry) => entry.disposition === "RETIRE")).toEqual([]);
    expect(
      ROUTE_DISPOSITIONS.filter((entry) => /demo/i.test(entry.module) || /demo/i.test(entry.path)),
    ).toEqual([]);
  });

  it("matches the deterministic generated route ledger", () => {
    const generated = JSON.parse(
      readFileSync("release/checklists/OCADE_ROUTE_DISPOSITIONS.json", "utf8"),
    );
    expect(generated.summary.total).toBe(98);
    expect(generated.summary.modulesOnDisk).toBe(98);
    expect(generated.routes).toEqual(ROUTE_DISPOSITIONS);
    expect(
      generated.routes.every((entry: { module: string }) => !entry.module.includes("\\")),
    ).toBe(true);
  });
});

describe("the validator itself", () => {
  it("notices a route on disk that nobody has placed", () => {
    const problems = validateRouteLedger([...ROUTE_DISPOSITIONS.map((e) => e.module), "unplaced"]);
    expect(problems).toContain("unplaced: on disk with no entry in the ledger");
  });

  it("notices an entry whose module is gone", () => {
    const problems = validateRouteLedger(
      ROUTE_DISPOSITIONS.map((e) => e.module).filter((m) => m !== "_authenticated/ocade.work"),
    );
    expect(problems).toContain("_authenticated/ocade.work: in the ledger with no module on disk");
  });
});
