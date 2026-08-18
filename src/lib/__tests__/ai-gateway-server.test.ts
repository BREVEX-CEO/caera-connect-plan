import { describe, expect, it } from "vitest";
import {
  createLovableGateway,
  createOpenAIDirectGateway,
  describeModel,
  OCADE_DEFAULT_MODEL,
  OCADE_MODEL_DISPLAY,
} from "../ai-gateway.server";

describe("retired server AI gateway", () => {
  it("fails closed instead of constructing a Lovable provider", () => {
    expect(() => createLovableGateway("secret")).toThrow(/cloud ai routing has been removed/i);
  });

  it("fails closed instead of constructing an OpenAI provider", () => {
    expect(() => createOpenAIDirectGateway("secret")).toThrow(/cloud ai routing has been removed/i);
  });

  it("publishes only the local capability", () => {
    expect(OCADE_DEFAULT_MODEL).toBe("ocade/local");
    expect(Object.keys(OCADE_MODEL_DISPLAY)).toEqual(["ocade/local"]);
    expect(describeModel("anything").locality).toBe("local");
    expect(describeModel("anything").vision).toBe(false);
  });
});
