import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  CRITERIA,
  buildScorecard,
  describeScorecard,
  SCORECARD_SCOPE,
} from "../skills/criteria-scorecard";
import { PackRegistry, coverageReport } from "../skills/pack-registry";

/**
 * A scorecard that cannot be falsified is marketing.
 *
 * These tests are what make it evidence: every module and test file it cites
 * must actually exist, so the score decays the moment the code stops backing
 * it. A hand-written percentage never does that — which is exactly why one
 * isn't here.
 */

const SRC = resolve(__dirname, "..", "..");

describe("every claim in the scorecard points at code that exists", () => {
  it.each(CRITERIA.map((c) => [c.id, c] as const))(
    "%s names modules that are really there",
    (_id, criterion) => {
      for (const modulePath of criterion.modules) {
        expect(existsSync(resolve(SRC, modulePath)), `missing module: ${modulePath}`).toBe(true);
      }
    },
  );

  it.each(CRITERIA.map((c) => [c.id, c] as const))(
    "%s names tests that are really there",
    (_id, criterion) => {
      for (const testFile of criterion.provenBy) {
        expect(
          existsSync(resolve(SRC, "lib", "__tests__", testFile)),
          `missing test: ${testFile}`,
        ).toBe(true);
      }
    },
  );

  it("covers all eight criteria without duplicates", () => {
    expect(CRITERIA).toHaveLength(8);
    expect(new Set(CRITERIA.map((c) => c.id)).size).toBe(8);
  });

  /**
   * A criterion with no stated gap is a criterion nobody looked hard at. Every
   * one must name what is still missing.
   */
  it("states an honest gap for every criterion", () => {
    for (const c of CRITERIA) {
      expect(c.gap.length, `${c.id} has no stated gap`).toBeGreaterThan(20);
    }
  });
});

describe("the numbers match the registry, not a written-down figure", () => {
  it("derives category counts from the real coverage report", () => {
    const registry = new PackRegistry();
    const coverage = coverageReport(registry);
    const s = buildScorecard(registry);

    expect(s.categoriesTotal).toBe(coverage.length);
    expect(s.categoriesDriven).toBe(coverage.filter((r) => r.supported && !r.formatOnly).length);
    expect(s.categoriesFileOnly).toBe(coverage.filter((r) => r.formatOnly).length);
    // The two kinds must never be summed into one headline.
    expect(s.categoriesDriven + s.categoriesFileOnly).toBeLessThanOrEqual(s.categoriesTotal);
  });

  it("moves when the registry moves", () => {
    const registry = new PackRegistry([]);
    const empty = buildScorecard(registry);
    expect(empty.categoriesDriven).toBe(0);
    expect(empty.categoriesFileOnly).toBe(0);
    expect(buildScorecard().categoriesDriven).toBeGreaterThan(0);
  });

  it("reports both counts separately in its summary line", () => {
    const line = describeScorecard(buildScorecard());
    expect(line).toMatch(/drives the software in \d+ of \d+ categories/);
    expect(line).toMatch(/reads files in \d+ more/);
  });
});

/**
 * The disclaimer is part of the deliverable, not a footnote. It must say
 * plainly that no cross-product comparison was run — because one wasn't.
 */
describe("the scorecard refuses to imply a comparison it never made", () => {
  it("says no competing agent was benchmarked", () => {
    expect(SCORECARD_SCOPE).toMatch(/not a comparison with any other product/i);
    expect(SCORECARD_SCOPE).toMatch(/shared benchmark/i);
    expect(SCORECARD_SCOPE).toMatch(/invented rather than measured/i);
  });

  it("carries no parity or superiority figure anywhere in its output", () => {
    const everything =
      JSON.stringify(buildScorecard()) + describeScorecard(buildScorecard()) + SCORECARD_SCOPE;
    // A percentage against another product is precisely what must not appear.
    expect(everything).not.toMatch(/parity\s*[:=]\s*\d/i);
    expect(everything).not.toMatch(/superiority\s*[:=]\s*\d/i);
    expect(everything).not.toMatch(/\bbetter than\b/i);
  });
});
