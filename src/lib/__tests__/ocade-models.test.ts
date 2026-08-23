import { describe, it, expect } from "vitest";
import { OCADE_MODELS, OCADE_DEFAULT_MODEL_ID, getOcadeModel } from "../ocade-models";

/**
 * This file used to test a catalogue of hosted models and `autoSelectModel`,
 * which picked between them from privacy/cost/speed preferences. Both are gone
 * with cloud inference. What is left to prove is small and matters more: the
 * lookup must be total, because every stored message carries a `model_id` and
 * old rows name providers OCADE no longer uses.
 */
describe("the engine catalogue", () => {
  it("describes exactly one engine, and it is local", () => {
    expect(OCADE_MODELS).toHaveLength(1);
    expect(OCADE_MODELS[0].locality).toBe("local");
  });

  it("resolves the default", () => {
    expect(getOcadeModel(OCADE_DEFAULT_MODEL_ID).id).toBe(OCADE_DEFAULT_MODEL_ID);
  });

  it("resolves a historical hosted model id to the local engine rather than blanking", () => {
    // Messages persisted before cloud inference was removed carry ids like
    // this. A lookup that returned undefined would blank the label on every
    // one of those conversations.
    for (const legacy of ["google/gemini-3.5-flash", "openai/gpt-5.5", "", null, undefined]) {
      expect(getOcadeModel(legacy).locality).toBe("local");
      expect(getOcadeModel(legacy).display).toBe("OCADE Local");
    }
  });

  it("names no provider in anything a user can see", () => {
    for (const m of OCADE_MODELS) {
      expect(`${m.display} ${m.description}`).not.toMatch(/openai|google|gemini|gpt|anthropic/i);
    }
  });
});
