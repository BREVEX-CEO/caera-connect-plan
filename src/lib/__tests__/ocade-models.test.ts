import { describe, it, expect } from "vitest";
import {
  OCADE_MODELS,
  OCADE_DEFAULT_MODEL_ID,
  getOcadeModel,
  autoSelectModel,
} from "../ocade-models";

describe("OCADE model catalog", () => {
  it("resolves a known model and falls back to the default for unknown ids", () => {
    expect(getOcadeModel(OCADE_DEFAULT_MODEL_ID).id).toBe(OCADE_DEFAULT_MODEL_ID);
    expect(getOcadeModel("does/not-exist").id).toBe(OCADE_MODELS[0].id);
  });

  it("every model declares its vision capability consistently", () => {
    for (const m of OCADE_MODELS) {
      expect(m.vision).toBe(m.capabilities.image);
    }
  });
});

describe("autoSelectModel", () => {
  const base = {
    privacy: "balanced" as const,
    cost: "balanced" as const,
    speed: "balanced" as const,
    visionRequired: false,
  };

  it("honors a valid per-session override", () => {
    const { model, reasons } = autoSelectModel({
      ...base,
      sessionOverride: "openai/gpt-5.5",
    });
    expect(model.id).toBe("openai/gpt-5.5");
    expect(reasons.join(" ")).toMatch(/override/i);
  });

  it("flags local fallback needed under local_first privacy", () => {
    const { localFallbackNeeded } = autoSelectModel({ ...base, privacy: "local_first" });
    expect(localFallbackNeeded).toBe(true);
  });

  it("restricts to vision-capable models when vision is required", () => {
    const { model } = autoSelectModel({ ...base, visionRequired: true });
    expect(model.vision).toBe(true);
  });

  it("prefers a cheap-tier model when cost=cheapest", () => {
    const { model } = autoSelectModel({ ...base, cost: "cheapest" });
    expect(model.capabilities.costTier).toBe("cheap");
  });
});
