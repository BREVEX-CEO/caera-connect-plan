import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BarChart, FlowDiagram } from "@/components/ocade/VisualResponse";
import { planVisualResponse, chartFromRows, type ChartPoint } from "../ocade-visual";

/**
 * RENDER PROOF.
 *
 * The chart and diagram logic is unit-tested, but "the data is right" and "the
 * markup is right" are different claims. These actually render the components
 * (via `react-dom/server`, so no browser or extra dependency is needed) and
 * assert the produced HTML — including the accessibility guarantees, which are
 * invisible to a pure-function test.
 */

const series: ChartPoint[] = [
  { label: "North", value: 120, display: "120" },
  { label: "South", value: 80, display: "80" },
];

describe("bar chart renders", () => {
  it("produces one row per point with its label and display value", () => {
    const html = renderToStaticMarkup(<BarChart series={series} animated={false} />);
    expect(html).toContain("North");
    expect(html).toContain("South");
    expect(html).toContain("120");
    expect(html).toContain("80");
  });

  it("shows the ORIGINAL display string, never the normalised number", () => {
    const html = renderToStaticMarkup(
      <BarChart
        series={[
          { label: "Spend", value: 1200, display: "$1.2k" },
          { label: "Budget", value: 2000, display: "$2k" },
        ]}
        animated={false}
      />,
    );
    expect(html).toContain("$1.2k");
    expect(html).not.toContain("1200");
  });

  /**
   * The bars are decorative; the DATA must reach assistive tech. Without this
   * table the chart would convey meaning by length alone.
   */
  it("exposes the same data as a real table for screen readers", () => {
    const html = renderToStaticMarkup(
      <BarChart title="Revenue" series={series} animated={false} />,
    );
    expect(html).toContain("<table");
    expect(html).toContain("<caption>Revenue</caption>");
    expect(html).toContain('scope="row"');
    expect(html).toContain("sr-only");
  });

  it("hides the decorative bars from assistive tech", () => {
    const html = renderToStaticMarkup(<BarChart series={series} animated={false} />);
    expect(html).toContain("aria-hidden");
  });

  it("renders bar widths proportionally, largest widest", () => {
    const html = renderToStaticMarkup(<BarChart series={series} animated={false} />);
    const widths = [...html.matchAll(/width:\s*([\d.]+)%/g)].map((m) => Number(m[1]));
    expect(widths.length).toBeGreaterThanOrEqual(2);
    expect(widths[0]).toBeGreaterThan(widths[1]);
  });

  it("handles negatives without breaking layout", () => {
    const html = renderToStaticMarkup(
      <BarChart
        series={[
          { label: "Gain", value: 50, display: "50" },
          { label: "Loss", value: -30, display: "-30" },
        ]}
        animated={false}
      />,
    );
    expect(html).toContain("-30");
    // No NaN or Infinity leaked into a style attribute.
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("handles an all-zero series without dividing by zero", () => {
    const html = renderToStaticMarkup(
      <BarChart
        series={[
          { label: "A", value: 0, display: "0" },
          { label: "B", value: 0, display: "0" },
        ]}
        animated={false}
      />,
    );
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("renders nothing for an empty series rather than an empty frame", () => {
    expect(renderToStaticMarkup(<BarChart series={[]} animated={false} />)).toBe("");
  });

  it("omits the animation class when reduced resources are requested", () => {
    const plain = renderToStaticMarkup(<BarChart series={series} animated={false} />);
    const animated = renderToStaticMarkup(<BarChart series={series} animated />);
    expect(plain).not.toContain("motion-safe:transition");
    expect(animated).toContain("motion-safe:transition");
  });
});

describe("flow diagram renders", () => {
  it("renders each step in order as a list", () => {
    const html = renderToStaticMarkup(
      <FlowDiagram steps={[{ label: "Draft" }, { label: "Review" }, { label: "Publish" }]} />,
    );
    expect(html).toContain("<ol");
    expect(html.indexOf("Draft")).toBeLessThan(html.indexOf("Review"));
    expect(html.indexOf("Review")).toBeLessThan(html.indexOf("Publish"));
  });

  it("labels the flow for assistive tech", () => {
    const html = renderToStaticMarkup(<FlowDiagram steps={[{ label: "A" }, { label: "B" }]} />);
    expect(html).toContain('aria-label="Process flow"');
  });

  it("hides the connector arrows from screen readers", () => {
    const html = renderToStaticMarkup(<FlowDiagram steps={[{ label: "A" }, { label: "B" }]} />);
    expect(html).toContain("aria-hidden");
  });

  it("renders nothing for an empty flow", () => {
    expect(renderToStaticMarkup(<FlowDiagram steps={[]} />)).toBe("");
  });
});

describe("planner output renders end to end", () => {
  it("a numeric table becomes a chart AND keeps the exact figures", () => {
    const answer = [
      "| Region | Revenue |",
      "| --- | --- |",
      "| North | 120 |",
      "| South | 80 |",
    ].join("\n");
    const plan = planVisualResponse(answer);
    const chart = plan.blocks.find((b) => b.kind === "chart");
    expect(chart?.series).toBeTruthy();

    const html = renderToStaticMarkup(<BarChart series={chart!.series!} animated={false} />);
    expect(html).toContain("North");
    expect(html).toContain("120");
    // The table block is retained alongside, so precision is never lost.
    expect(plan.blocks.some((b) => b.kind === "table")).toBe(true);
  });

  it("a credential in the answer never reaches the rendered markup", () => {
    const plan = planVisualResponse("Login\nPassword: hunter2\nUsers: 40\nSessions: 60");
    const html = plan.blocks
      .filter((b) => b.kind === "chart")
      .map((b) => renderToStaticMarkup(<BarChart series={b.series!} animated={false} />))
      .join("");
    expect(html).not.toContain("hunter2");
  });

  it("mixed units never render on one axis", () => {
    // Guarded upstream: chartFromRows refuses, so no chart is produced at all.
    expect(
      chartFromRows([
        ["Metric", "Value"],
        ["Revenue", "42000"],
        ["Margin", "18%"],
      ]),
    ).toBeNull();
  });
});
