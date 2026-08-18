import { describe, expect, it } from "vitest";
import { resolveOcadeEngine, type EngineResolveInput } from "../ocade-router";

const base: EngineResolveInput = {
  routing: "auto",
  hasLovableKey: true,
  hasOpenAIKey: true,
  openaiDirectEnabled: true,
  requestedModel: "openai/gpt-5.5",
};

describe("resolveOcadeEngine local-only server boundary", () => {
  it("never returns a cloud engine even when stale cloud credentials are present", () => {
    const result = resolveOcadeEngine(base);
    expect(result).toMatchObject({ kind: "unavailable", code: "local_execution_only" });
  });

  it.each(["auto", "lovable_gateway", "openai_direct", "ollama_local", "caera_native", "cloud_only"])(
    "fails closed for legacy routing value %s",
    (routing) => {
      const result = resolveOcadeEngine({ ...base, routing });
      expect(result.kind).toBe("unavailable");
      expect(result.reason).toMatch(/device|local/i);
    },
  );

  it("never includes a remote provider or model in its resolution", () => {
    const serialized = JSON.stringify(resolveOcadeEngine(base));
    expect(serialized).not.toMatch(/lovable|openai|gemini|gpt/i);
  });
});
