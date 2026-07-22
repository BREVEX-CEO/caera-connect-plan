import { describe, it, expect } from "vitest";
import { resolveOcadeEngine, type EngineResolveInput } from "../ocade-router";

const base: EngineResolveInput = {
  routing: "auto",
  hasLovableKey: true,
  hasOpenAIKey: false,
  openaiDirectEnabled: false,
  requestedModel: "google/gemini-3.5-flash",
};

describe("resolveOcadeEngine", () => {
  it("routes auto to the cloud gateway and labels it Automatic", () => {
    const r = resolveOcadeEngine(base);
    expect(r).toMatchObject({ kind: "cloud", provider: "lovable", label: "OCADE Automatic" });
    if (r.kind === "cloud") expect(r.model).toBe("google/gemini-3.5-flash");
  });

  it("routes explicit lovable_gateway to OCADE Cloud", () => {
    const r = resolveOcadeEngine({ ...base, routing: "lovable_gateway" });
    expect(r).toMatchObject({ kind: "cloud", provider: "lovable", label: "OCADE Cloud" });
  });

  it("reports cloud unavailable when no cloud key is configured", () => {
    const r = resolveOcadeEngine({ ...base, hasLovableKey: false });
    expect(r).toMatchObject({ kind: "unavailable", code: "cloud_not_configured" });
  });

  it("routes OpenAI-direct only when enabled AND keyed, stripping the gateway prefix", () => {
    const r = resolveOcadeEngine({
      ...base,
      routing: "openai_direct",
      hasOpenAIKey: true,
      openaiDirectEnabled: true,
      requestedModel: "openai/gpt-5.5",
    });
    expect(r).toMatchObject({ kind: "cloud", provider: "openai", label: "OCADE Cloud" });
    if (r.kind === "cloud") expect(r.model).toBe("gpt-5.5");
  });

  it.each([
    { openaiDirectEnabled: true, hasOpenAIKey: false },
    { openaiDirectEnabled: false, hasOpenAIKey: true },
  ])("reports OpenAI-direct unavailable when not fully configured (%o)", (cfg) => {
    const r = resolveOcadeEngine({ ...base, routing: "openai_direct", ...cfg });
    expect(r).toMatchObject({ kind: "unavailable", code: "openai_not_configured" });
  });

  it("never silently substitutes cloud for a local routing choice", () => {
    const r = resolveOcadeEngine({ ...base, routing: "ollama_local" });
    expect(r).toMatchObject({ kind: "unavailable", code: "local_requires_companion" });
  });

  it("reports the reserved native engine as unavailable", () => {
    const r = resolveOcadeEngine({ ...base, routing: "caera_native" });
    expect(r).toMatchObject({ kind: "unavailable", code: "native_not_released" });
  });
});
