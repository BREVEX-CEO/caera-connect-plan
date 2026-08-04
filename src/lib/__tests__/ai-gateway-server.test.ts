import { describe, it, expect, vi } from "vitest";

/**
 * Server-only AI gateway helpers.
 *
 * Two things are worth pinning here:
 *
 *  1. THE KEY GOES IN A HEADER, NOT A URL. A key in a query string is logged by
 *     proxies, caches and browser history. These tests assert the credential
 *     appears only in the header for each provider, and never in the baseURL.
 *  2. `describeModel` MUST NOT INVENT CAPABILITIES. For an unknown model id it
 *     falls back to `vision: false` — claiming vision support the model may not
 *     have would make OCADE send an image that is silently ignored.
 */

const created: Array<Record<string, unknown>> = [];

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn((config: Record<string, unknown>) => {
    created.push(config);
    return { __config: config };
  }),
}));

const {
  createLovableGateway,
  createOpenAIDirectGateway,
  describeModel,
  OCADE_DEFAULT_MODEL,
  OCADE_MODEL_DISPLAY,
} = await import("../ai-gateway.server");

const SECRET = "sk-test-secret-key-value";

describe("gateway construction keeps the credential in a header", () => {
  it("builds the Lovable gateway against the gateway base URL", () => {
    created.length = 0;
    createLovableGateway(SECRET);

    const config = created[0];
    expect(config.name).toBe("lovable");
    expect(String(config.baseURL)).toBe("https://ai.gateway.lovable.dev/v1");
    expect((config.headers as Record<string, string>)["Lovable-API-Key"]).toBe(SECRET);
    // The credential must not be smuggled into the URL.
    expect(String(config.baseURL)).not.toContain(SECRET);
  });

  it("builds the OpenAI-direct gateway with a Bearer header", () => {
    created.length = 0;
    createOpenAIDirectGateway(SECRET);

    const config = created[0];
    expect(config.name).toBe("openai");
    expect(String(config.baseURL)).toBe("https://api.openai.com/v1");
    expect((config.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);
    expect(String(config.baseURL)).not.toContain(SECRET);
  });

  it("uses https for both providers", () => {
    created.length = 0;
    createLovableGateway(SECRET);
    createOpenAIDirectGateway(SECRET);
    for (const config of created) {
      expect(String(config.baseURL).startsWith("https://")).toBe(true);
    }
  });

  it("keeps the two providers on genuinely different hosts", () => {
    created.length = 0;
    createLovableGateway(SECRET);
    createOpenAIDirectGateway(SECRET);
    expect(created[0].baseURL).not.toBe(created[1].baseURL);
  });
});

describe("describeModel", () => {
  it("describes every model in the display table", () => {
    for (const [id, entry] of Object.entries(OCADE_MODEL_DISPLAY)) {
      expect(describeModel(id)).toEqual(entry);
    }
  });

  it("describes the default model, so the default is never an unknown id", () => {
    expect(OCADE_MODEL_DISPLAY[OCADE_DEFAULT_MODEL]).toBeDefined();
    expect(describeModel(OCADE_DEFAULT_MODEL).display).not.toBe(OCADE_DEFAULT_MODEL);
  });

  it("does NOT claim vision support for an unknown model", () => {
    // Inventing vision support would make OCADE send an image the model ignores.
    const unknown = describeModel("some/unreleased-model");
    expect(unknown.vision).toBe(false);
  });

  it("falls back to the raw id rather than inventing a product name", () => {
    expect(describeModel("some/unreleased-model").display).toBe("some/unreleased-model");
  });

  it("marks an unknown model as cloud, the conservative assumption", () => {
    // Assuming "local" would imply the request never leaves the device.
    expect(describeModel("some/unreleased-model").locality).toBe("cloud");
  });

  it("handles an empty id without throwing", () => {
    expect(() => describeModel("")).not.toThrow();
    expect(describeModel("").vision).toBe(false);
  });
});

describe("model display table integrity", () => {
  it("gives every entry a display name, provider and locality", () => {
    for (const [id, entry] of Object.entries(OCADE_MODEL_DISPLAY)) {
      expect(entry.display.trim().length, id).toBeGreaterThan(0);
      expect(entry.provider.trim().length, id).toBeGreaterThan(0);
      expect(["cloud", "local"]).toContain(entry.locality);
      expect(typeof entry.vision).toBe("boolean");
    }
  });

  it("never shows the raw id as the display name for a known model", () => {
    for (const [id, entry] of Object.entries(OCADE_MODEL_DISPLAY)) {
      expect(entry.display).not.toBe(id);
    }
  });
});
