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
