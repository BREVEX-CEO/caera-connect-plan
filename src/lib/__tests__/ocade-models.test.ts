import { describe, expect, it } from "vitest";
import {
  OCADE_MODELS,
  OCADE_PROVIDERS,
  OCADE_DEFAULT_MODEL_ID,
  getOcadeModel,
  autoSelectModel,
} from "../ocade-models";

describe("OCADE local-only model catalog", () => {
  it("contains exactly one local product capability", () => {
    expect(OCADE_MODELS).toHaveLength(1);
    expect(OCADE_PROVIDERS).toHaveLength(1);
    expect(OCADE_MODELS[0]).toMatchObject({ id: "ocade/local", locality: "local" });
    expect(OCADE_PROVIDERS[0]).toMatchObject({ id: "local_runtime", locality: "local", requiresSecret: false });
  });

  it("falls unknown ids back to the local capability, never a cloud model", () => {
    expect(getOcadeModel(OCADE_DEFAULT_MODEL_ID).id).toBe("ocade/local");
    expect(getOcadeModel("openai/gpt-5.5").id).toBe("ocade/local");
  });

  it("does not advertise vision when no on-device vision model is configured", () => {
    expect(OCADE_MODELS[0].vision).toBe(false);
    expect(OCADE_MODELS[0].capabilities.image).toBe(false);
  });
});

describe("autoSelectModel", () => {
  it("ignores a stale remote session override and still returns local", () => {
    const { model, reasons, localFallbackNeeded } = autoSelectModel({
      privacy: "local_first",
      cost: "local",
      speed: "balanced",
      visionRequired: false,
      sessionOverride: "openai/gpt-5.5",
    });
    expect(model.id).toBe("ocade/local");
    expect(localFallbackNeeded).toBe(false);
    expect(reasons.join(" ")).toMatch(/local-only/i);
  });
});
