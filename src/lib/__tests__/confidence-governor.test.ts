import { describe, it, expect } from "vitest";
import {
  governConfidence,
  thresholdFor,
  READ_THRESHOLD,
  MUTATE_THRESHOLD,
  UNVERIFIABLE_MUTATE_THRESHOLD,
  type GovernInput,
} from "../skills/confidence-governor";

const base = (over: Partial<GovernInput> = {}): GovernInput => ({
  confidence: 0.95,
  mutating: false,
  verifyBy: "api",
  plannedMethod: "dom",
  availableMethods: ["dom"],
  canReobserve: false,
  ...over,
});

describe("thresholds rise with consequence", () => {
  it("a mutation needs more confidence than a read", () => {
    expect(thresholdFor(false, "api")).toBe(READ_THRESHOLD);
    expect(thresholdFor(true, "api")).toBe(MUTATE_THRESHOLD);
    expect(MUTATE_THRESHOLD).toBeGreaterThan(READ_THRESHOLD);
  });

  /**
   * An unverifiable mutation needs the most, because if the guess is wrong
   * nothing will ever say so.
   */
  it("an unverifiable mutation needs the most", () => {
    expect(thresholdFor(true, "none")).toBe(UNVERIFIABLE_MUTATE_THRESHOLD);
    expect(UNVERIFIABLE_MUTATE_THRESHOLD).toBeGreaterThan(MUTATE_THRESHOLD);
  });
});

describe("high confidence proceeds", () => {
  it("lets a confident read through", () => {
    expect(governConfidence(base({ confidence: 0.8 })).action).toBe("proceed");
  });

  it("lets a confident mutation through", () => {
    expect(governConfidence(base({ mutating: true, confidence: 0.8 })).action).toBe("proceed");
  });
});

describe("the remedy ordering is cheapest-first", () => {
  /**
   * A safer route needs no human and yields a more trustworthy result, so it
   * beats both re-observing and asking.
   */
  it("re-routes to a more reliable method before anything else", () => {
    const d = governConfidence(
      base({
        confidence: 0.5,
        mutating: true,
        plannedMethod: "vision_input",
        availableMethods: ["vision_input", "official_api", "dom"],
        canReobserve: true, // available, but re-route should win
      }),
    );
    expect(d.action).toBe("reroute");
    if (d.action !== "reroute") throw new Error("unreachable");
    // official_api is the most reliable of what's available.
    expect(d.to).toBe("official_api");
  });

  it("re-observes when no safer method exists but the reading can be refreshed", () => {
    const d = governConfidence(
      base({
        confidence: 0.5,
        mutating: true,
        plannedMethod: "official_api", // already the best available
        availableMethods: ["official_api"],
        canReobserve: true,
      }),
    );
    expect(d.action).toBe("reobserve");
  });

  it("asks the user only when it cannot raise its own confidence", () => {
    const d = governConfidence(
      base({
        confidence: 0.5,
        mutating: true,
        plannedMethod: "official_api",
        availableMethods: ["official_api"],
        canReobserve: false,
      }),
    );
    expect(d.action).toBe("require_approval");
  });
});

/**
 * The rule that cannot be tuned away: a low-confidence MUTATION never silently
 * proceeds.
 */
describe("a low-confidence mutation never silently proceeds", () => {
  it("escalates rather than proceeding when no remedy is available", () => {
    const d = governConfidence(
      base({
        confidence: 0.4,
        mutating: true,
        plannedMethod: "official_api",
        availableMethods: ["official_api"],
        canReobserve: false,
      }),
    );
    expect(d.action).not.toBe("proceed");
    expect(d.action).toBe("require_approval");
  });

  /**
   * An unverifiable low-confidence mutation is the most dangerous case, and the
   * approval message must say WHY: there's no signal that would catch a wrong
   * guess later.
   */
  it("names the danger for an unverifiable change", () => {
    const d = governConfidence(
      base({
        confidence: 0.6,
        mutating: true,
        verifyBy: "none",
        plannedMethod: "official_api",
        availableMethods: ["official_api"],
        canReobserve: false,
      }),
    );
    expect(d.action).toBe("require_approval");
    if (d.action !== "require_approval") throw new Error("unreachable");
    expect(d.reason).toMatch(/no way to verify the result afterwards/i);
  });

  it("holds an unverifiable mutation to the highest bar", () => {
    // 0.8 clears the ordinary mutate bar but not the unverifiable one.
    const verifiable = governConfidence(base({ mutating: true, verifyBy: "ui", confidence: 0.8 }));
    const unverifiable = governConfidence(
      base({
        mutating: true,
        verifyBy: "none",
        confidence: 0.8,
        plannedMethod: "official_api",
        availableMethods: ["official_api"],
        canReobserve: false,
      }),
    );
    expect(verifiable.action).toBe("proceed");
    expect(unverifiable.action).toBe("require_approval");
  });
});

/**
 * A wrong read is recoverable, so a low-confidence read may proceed — but only
 * flagged, and only when nothing better is available.
 */
describe("a low-confidence read may proceed, flagged", () => {
  it("proceeds with a caveat when it can't do better", () => {
    const d = governConfidence(
      base({
        confidence: 0.4,
        mutating: false,
        plannedMethod: "official_api",
        availableMethods: ["official_api"],
        canReobserve: false,
      }),
    );
    expect(d.action).toBe("proceed");
    expect(d.reason).toMatch(/flag the result as low-confidence/i);
  });

  it("still prefers a safer route for a read when one exists", () => {
    const d = governConfidence(
      base({
        confidence: 0.4,
        mutating: false,
        plannedMethod: "vision_input",
        availableMethods: ["vision_input", "dom"],
        canReobserve: false,
      }),
    );
    expect(d.action).toBe("reroute");
  });
});

describe("guards", () => {
  it("refuses when no method is available at all", () => {
    expect(governConfidence(base({ availableMethods: [] })).action).toBe("refuse");
  });

  it("refuses an out-of-range confidence rather than trusting it", () => {
    expect(governConfidence(base({ confidence: 1.5 })).action).toBe("refuse");
    expect(governConfidence(base({ confidence: -0.1 })).action).toBe("refuse");
    expect(governConfidence(base({ confidence: NaN })).action).toBe("refuse");
  });
});
