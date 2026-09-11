import { describe, expect, it } from "vitest";
import { classifyFreshness } from "../research/freshness-classifier";

describe("ordinary Chat freshness routing", () => {
  it.each([
    "What is the capital of France?",
    "Explain photosynthesis to a twelve year old",
    "Rewrite this price announcement in a friendlier tone",
    "Calculate 137 + 486",
  ])("keeps timeless work local: %s", (query) => {
    expect(classifyFreshness(query).route).toBe("local");
  });

  it.each([
    "What is the weather in Bengaluru?",
    "Who is the current CEO of Microsoft?",
    "What is the latest stable version of Chrome?",
    "Give me today's Bitcoin price",
    "Are the UK visa rules still valid?",
  ])("routes changeable facts to current information: %s", (query) => {
    expect(classifyFreshness(query).route).toBe("current_information");
  });

  it("marks fast-moving subjects as realtime", () => {
    expect(classifyFreshness("What is the weather in Bengaluru?").volatility).toBe("realtime");
  });
});

describe("a year that has finished is history, not news", () => {
  /*
   * THE DEFECT THIS CLOSES. "What was the stock price of Apple in 2019" matched
   * the volatile subject `stock` and was routed to the network to look up a
   * number that has not changed in years — a request the person did not ask
   * for, on a product whose promise is that it does not make them. The rule was
   * written and proven in a second freshness module that nothing ever called;
   * it lives here now, in the one the router uses.
   */
  const NOW = new Date("2026-08-23T00:00:00Z");

  it("keeps a question about a finished year on the device", () => {
    const decision = classifyFreshness("What was the stock price of Apple in 2019?", NOW);
    expect(decision.route).toBe("local");
    expect(decision.matched).toContain("2019");
  });

  it("still retrieves when the question names a past year AND asks about today", () => {
    // "latest" is the more specific signal: the year is context, not the subject.
    expect(classifyFreshness("Since 2019, what is the latest guidance?", NOW).route).toBe(
      "current_information",
    );
  });

  it("does not let the current or a future year settle anything", () => {
    expect(classifyFreshness("Who won the 2026 election results?", NOW).route).toBe(
      "current_information",
    );
    expect(classifyFreshness("What are the 2030 exchange rate forecasts?", NOW).route).toBe(
      "current_information",
    );
  });
});
