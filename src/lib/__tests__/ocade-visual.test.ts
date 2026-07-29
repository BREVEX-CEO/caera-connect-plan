import { describe, it, expect } from "vitest";
import {
  parseNumeric,
  parseDiagram,
  chartFromRows,
  chartFromMetrics,
  unitOf,
} from "../ocade-visual";

/**
 * A chart that plots the wrong number, or plots only the rows it could parse,
 * would silently misstate the answer. These pin that it refuses instead.
 */
describe("reading numbers for a chart", () => {
  it.each([
    ["42", 42],
    ["-7", -7],
    ["3.5", 3.5],
    ["1,024", 1024],
    ["50%", 50],
    ["$1.2k", 1200],
    ["2M", 2_000_000],
  ])("parses %s", (raw, expected) => {
    expect(parseNumeric(raw)?.value).toBe(expected);
  });

  it("keeps the ORIGINAL text for display, never the normalised number", () => {
    expect(parseNumeric("$1.2k")?.display).toBe("$1.2k");
    expect(parseNumeric("50%")?.display).toBe("50%");
  });

  it.each(["", "  ", "n/a", "about 40", "12 apples", "1-2", "yes"])(
    "refuses %o rather than guessing a value",
    (raw) => {
      expect(parseNumeric(raw)).toBeNull();
    },
  );
});

describe("charting a table", () => {
  it("plots a two-column numeric table, skipping the header", () => {
    const series = chartFromRows([
      ["Region", "Revenue"],
      ["North", "120"],
      ["South", "80"],
    ]);
    expect(series).toEqual([
      { label: "North", value: 120, display: "120" },
      { label: "South", value: 80, display: "80" },
    ]);
  });

  it("REFUSES a table with a non-numeric row rather than plotting a subset", () => {
    expect(
      chartFromRows([
        ["Region", "Revenue"],
        ["North", "120"],
        ["South", "not reported"],
      ]),
    ).toBeNull();
  });

  it("refuses a table with too little data to compare", () => {
    expect(
      chartFromRows([
        ["Region", "Revenue"],
        ["North", "120"],
      ]),
    ).toBeNull();
  });

  it("refuses when only metrics partially parse", () => {
    expect(
      chartFromMetrics([
        { label: "Users", value: "1200" },
        { label: "Status", value: "healthy" },
      ]),
    ).toBeNull();
  });

  it("charts key figures that share a unit", () => {
    const series = chartFromMetrics([
      { label: "Users", value: "1,200" },
      { label: "Sessions", value: "3.4k" },
    ]);
    expect(series).toHaveLength(2);
    expect(series?.[0].value).toBe(1200);
    expect(series?.[1].value).toBe(3400);
  });

  /**
   * One axis for "42000" and "18%" renders the percentage as an invisible
   * sliver and invites the wrong conclusion. Mixed units must be listed instead.
   */
  it("REFUSES to put mixed units on one axis", () => {
    expect(
      chartFromMetrics([
        { label: "Revenue", value: "42000" },
        { label: "Margin", value: "18%" },
      ]),
    ).toBeNull();
    expect(
      chartFromMetrics([
        { label: "Spend", value: "$400" },
        { label: "Rate", value: "12%" },
      ]),
    ).toBeNull();
  });

  it("treats k/M/B as magnitude, not a different unit", () => {
    expect(unitOf("1.2k")).toBe(unitOf("800"));
    expect(unitOf("$1.2k")).toBe("$");
    expect(unitOf("18%")).toBe("%");
  });
});

describe("detecting a flow diagram", () => {
  it.each(["Draft -> Review -> Publish", "Draft → Review", "A => B", "A --> B"])(
    "reads %s as a flow",
    (line) => {
      expect(parseDiagram(line)?.length).toBeGreaterThanOrEqual(2);
    },
  );

  it("keeps the step order", () => {
    expect(parseDiagram("Draft → Review → Publish")?.map((s) => s.label)).toEqual([
      "Draft",
      "Review",
      "Publish",
    ]);
  });

  it("ignores an arrow used inside ordinary prose", () => {
    expect(
      parseDiagram(
        "This means the request goes to the server -> and then a long explanation follows here",
      ),
    ).toBeNull();
  });

  it("needs at least two steps", () => {
    expect(parseDiagram("Draft ->")).toBeNull();
    expect(parseDiagram("no arrow here")).toBeNull();
  });
});

import {
  planVisualResponse,
  chooseVisualMode,
  describeRenderCost,
  visualPlanToText,
} from "../ocade-visual";

describe("planVisualResponse", () => {
  it("extracts steps from a numbered answer", () => {
    const plan = planVisualResponse(
      "How to deploy\n1. Build the app\n2. Run the migration\n3. Ship it",
    );
    const steps = plan.blocks.find((b) => b.kind === "steps");
    expect(steps?.lines).toEqual(["Build the app", "Run the migration", "Ship it"]);
    expect(plan.worthVisualising).toBe(true);
  });

  it("extracts fenced code with its language", () => {
    const plan = planVisualResponse("Example:\n```ts\nconst a = 1;\n```");
    const code = plan.blocks.find((b) => b.kind === "code");
    expect(code?.language).toBe("ts");
    expect(code?.lines).toEqual(["const a = 1;"]);
  });

  it("extracts a markdown table and drops separator rows", () => {
    const plan = planVisualResponse("| name | qty |\n| --- | --- |\n| bolt | 9 |");
    const table = plan.blocks.find((b) => b.kind === "table");
    expect(table?.rows?.some((r) => r.join("").includes("---"))).toBe(false);
    expect(table?.rows?.length).toBe(2);
  });

  it("extracts key figures as metrics", () => {
    const plan = planVisualResponse("Summary\nRevenue: 42000\nMargin: 18%");
    const metrics = plan.blocks.find((b) => b.kind === "metrics");
    expect(metrics?.metrics).toEqual([
      { label: "Revenue", value: "42000" },
      { label: "Margin", value: "18%" },
    ]);
  });

  it("redacts credential values before they can be rendered", () => {
    const plan = planVisualResponse("Login\nThe password is swordfish and the otp is 483920");
    const text = visualPlanToText(plan);
    expect(text).not.toContain("swordfish");
    expect(text).not.toContain("483920");
    expect(text).toContain("[redacted]");
  });

  it("redacts card-shaped numbers", () => {
    expect(visualPlanToText(planVisualResponse("Card 4111111111111111"))).not.toContain(
      "4111111111111111",
    );
  });

  it("PRESERVES ordinary figures so charts and metrics stay useful", () => {
    // Over-redaction would gut a metrics panel; only credential-shaped values go.
    const plan = planVisualResponse("Summary\nRevenue: 42000\nUsers: 15300");
    const text = visualPlanToText(plan);
    expect(text).toContain("42000");
    expect(text).toContain("15300");
  });

  it("says plain prose is not worth visualising", () => {
    const plan = planVisualResponse("Just a short conversational reply with no structure.");
    expect(plan.worthVisualising).toBe(false);
  });

  it("never throws on empty or odd input", () => {
    expect(() => planVisualResponse("")).not.toThrow();
    expect(planVisualResponse("").blocks.length).toBeGreaterThanOrEqual(0);
  });

  it("scales the cost estimate with answer size", () => {
    expect(planVisualResponse("short").estimatedCost).toBe("low");
    expect(planVisualResponse("x".repeat(13_000)).estimatedCost).toBe("high");
  });
});

describe("chooseVisualMode", () => {
  const plan = planVisualResponse("Steps\n1. one\n2. two");

  it("is unavailable without a renderer — never pretends", () => {
    const m = chooseVisualMode({ renderer: false, speech: true, lowResource: false }, plan);
    expect(m.mode).toBe("unavailable");
  });

  it("degrades to reduced on a low-resource device", () => {
    const m = chooseVisualMode({ renderer: true, speech: true, lowResource: true }, plan);
    expect(m.mode).toBe("reduced");
    if (m.mode === "reduced") expect(m.reason).toMatch(/low-motion|low-performance/i);
  });

  it("degrades to reduced for a very large answer", () => {
    const big = planVisualResponse("y".repeat(13_000) + "\n1. step");
    const m = chooseVisualMode({ renderer: true, speech: false, lowResource: false }, big);
    expect(m.mode).toBe("reduced");
  });

  it("renders fully and narrates when speech is available", () => {
    const m = chooseVisualMode({ renderer: true, speech: true, lowResource: false }, plan);
    expect(m).toMatchObject({ mode: "full", narrate: true });
  });
});

describe("describeRenderCost", () => {
  it("warns before an expensive render", () => {
    expect(describeRenderCost(planVisualResponse("z".repeat(13_000)))).toMatch(/few seconds/i);
    expect(describeRenderCost(planVisualResponse("hi"))).toMatch(/instantly/i);
  });
});

describe("visualPlanToText", () => {
  it("round-trips structure into exportable text", () => {
    const text = visualPlanToText(planVisualResponse("Plan\n1. a\n2. b\n```js\nx()\n```"));
    expect(text).toContain("1. a");
    expect(text).toContain("```js");
  });
});
