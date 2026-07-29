import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CriteriaScorecard } from "@/components/ocade/CriteriaScorecard";
import { BenchmarkPanel } from "@/components/ocade/BenchmarkPanel";
import { CRITERIA } from "../skills/criteria-scorecard";
import { BENCHMARK_TASKS } from "../skills/benchmark/tasks";

/**
 * RENDER PROOF.
 *
 * "The data is honest" and "the honest part reaches the screen" are different
 * claims, and every UI defect found in this project has lived in the gap
 * between them — a success and an error shown at once, a limitation that never
 * rendered, a control that looked available and wasn't.
 *
 * These render the real components and assert the produced HTML.
 */

const scorecard = () => renderToStaticMarkup(<CriteriaScorecard />);
const benchmark = () => renderToStaticMarkup(<BenchmarkPanel />);

describe("the scorecard reaches the screen intact", () => {
  it("mounts without throwing", () => {
    expect(() => scorecard()).not.toThrow();
  });

  it("shows every criterion, not a selected few", () => {
    const html = scorecard();
    for (const c of CRITERIA) {
      expect(html, `missing criterion: ${c.id}`).toContain(c.label);
    }
  });

  /**
   * The assertion that matters most. A scorecard whose limitations render only
   * in a tooltip is a scorecard with no limitations, as far as a reader is
   * concerned.
   */
  it("renders every stated gap alongside its mechanism", () => {
    const html = scorecard();
    for (const c of CRITERIA) {
      // Compare on a distinctive fragment: the full text may be HTML-escaped.
      const fragment = c.gap.split(/[;.]/)[0].slice(0, 30);
      expect(html, `gap not shown for ${c.id}`).toContain(fragment);
    }
    expect((html.match(/Still missing:/g) ?? []).length).toBe(CRITERIA.length);
  });

  it("renders the scope disclaimer in the same panel as the numbers", () => {
    const html = scorecard();
    expect(html).toMatch(/not a comparison with any other product/i);
    // And it is not merely present — it sits after the figures it qualifies.
    expect(html.indexOf("criteria are backed")).toBeLessThan(
      html.indexOf("not a comparison with any other product"),
    );
  });

  it("never presents file-format coverage as driving the software", () => {
    const html = scorecard();
    expect(html).toMatch(/drives the software in \d+ of \d+ categories/);
    expect(html).toMatch(/reads files in \d+ more/);
  });
});

describe("the benchmark panel", () => {
  it("mounts without throwing", () => {
    expect(() => benchmark()).not.toThrow();
  });

  it("states the task count and how many are traps, before running", () => {
    const html = benchmark();
    expect(html).toContain(`${BENCHMARK_TASKS.length} tasks`);
    expect(html).toMatch(/traps where the only correct answer is to refuse/i);
  });

  /**
   * A benchmark that runs itself on mount and displays a green number is
   * decoration. The user must trigger it and watch it happen, so there must be
   * no result in the markup until they do.
   */
  it("shows no result until the user asks for one", () => {
    const html = benchmark();
    expect(html).toContain("Run it now");
    expect(html).not.toContain("Run it again");
    expect(html).not.toContain("Every task passed");
    // An empty live region would announce nothing and clutter the tree.
    expect(html).not.toContain('role="status"');
  });

  it("promises the run happens locally, which is the claim being made", () => {
    expect(benchmark()).toMatch(/offline/i);
    expect(benchmark()).toMatch(/nothing is precomputed/i);
  });

  it("offers a real button rather than text that looks like one", () => {
    expect(benchmark()).toMatch(/<button[^>]*>[\s\S]*?Run it now/);
  });
});
