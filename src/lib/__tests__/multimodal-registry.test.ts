import { describe, expect, it, vi } from "vitest";
import { MultimodalRegistry, globalMultimodalRegistry } from "../providers/multimodal-registry";

describe("MultimodalRegistry", () => {
  it("registers and retrieves voice providers", () => {
    const registry = new MultimodalRegistry();
    const provider = {
      id: "test-voice",
      type: "system" as const,
      name: "Test Voice",
      isAvailable: async () => true,
      synthesize: async () => new ArrayBuffer(0),
      transcribe: async () => "test",
    };
    registry.registerVoiceProvider(provider);
    expect(registry.getVoiceProvider("test-voice")).toBe(provider);
    expect(registry.getVoiceProviders()).toContain(provider);
  });

  it("registers and retrieves vision connectors", () => {
    const registry = new MultimodalRegistry();
    const connector = {
      id: "test-vision",
      name: "Test Vision",
      isAvailable: async () => true,
      analyzeImage: async () => "test",
    };
    registry.registerVisionConnector(connector);
    expect(registry.getVisionConnector("test-vision")).toBe(connector);
  });

  it("registers and retrieves media connectors", () => {
    const registry = new MultimodalRegistry();
    const connector = {
      id: "test-media",
      name: "Test Media",
      isAvailable: async () => true,
      extractMetadata: async () => ({ format: "mp4" }),
      transcode: async () => new Uint8Array(),
    };
    registry.registerMediaConnector(connector);
    expect(registry.getMediaConnector("test-media")).toBe(connector);
  });

  it("registers and retrieves headless connectors", () => {
    const registry = new MultimodalRegistry();
    const connector = {
      id: "test-headless",
      name: "Test Headless",
      isAvailable: async () => true,
      executeScript: async () => "done",
    };
    registry.registerHeadlessConnector(connector);
    expect(registry.getHeadlessConnector("test-headless")).toBe(connector);
  });
});

/**
 * Registration hardening.
 *
 * The registry previously accepted anything and overwrote silently on a repeat
 * id. That is a hijack seam: whatever registers last owns the path speech and
 * transcription run through, and a malformed entry only fails later, at the
 * point of use, where the cause is far harder to see.
 */
describe("registration is refused rather than silently accepted", () => {
  const voice = (over: Record<string, unknown> = {}) =>
    ({
      id: "v1",
      type: "system",
      name: "Voice",
      isAvailable: async () => true,
      synthesize: async () => new ArrayBuffer(0),
      transcribe: async () => "",
      ...over,
    }) as never;

  it("REFUSES a second provider with the same id instead of replacing it", () => {
    const registry = new MultimodalRegistry();
    registry.registerVoiceProvider(voice());
    expect(() => registry.registerVoiceProvider(voice({ name: "Impostor" }))).toThrow(
      /already registered/i,
    );
    // The original survives; the takeover did not happen.
    expect(registry.getVoiceProvider("v1")?.name).toBe("Voice");
    expect(registry.getVoiceProviders()).toHaveLength(1);
  });

  it("refuses an empty id or name", () => {
    const registry = new MultimodalRegistry();
    expect(() => registry.registerVoiceProvider(voice({ id: "  " }))).toThrow(/non-empty id/i);
    expect(() => registry.registerVoiceProvider(voice({ name: "" }))).toThrow(/non-empty name/i);
  });

  it("refuses a provider that declares NO capability at all", () => {
    // synthesize/transcribe/speakAloud are each optional — no browser engine
    // can return audio bytes — but a provider offering none of the three would
    // register cleanly and then fail at the point of use.
    const registry = new MultimodalRegistry();
    expect(() =>
      registry.registerVoiceProvider(voice({ synthesize: undefined, transcribe: undefined })),
    ).toThrow(/declares no capability/i);
  });

  it("accepts a provider that declares only ONE capability", () => {
    // The real case: the platform speech engine can speak but cannot render
    // audio to a buffer or transcribe one.
    const registry = new MultimodalRegistry();
    registry.registerVoiceProvider(
      voice({ id: "speak-only", synthesize: undefined, transcribe: undefined, speakAloud: async () => {} }),
    );
    expect(registry.getSpeakingProviders()).toHaveLength(1);
  });

  it("still refuses a provider whose isAvailable is missing", () => {
    const registry = new MultimodalRegistry();
    expect(() => registry.registerVoiceProvider(voice({ isAvailable: undefined }))).toThrow(
      /missing isAvailable/i,
    );
  });

  it("refuses an unknown voice provider type", () => {
    const registry = new MultimodalRegistry();
    expect(() => registry.registerVoiceProvider(voice({ type: "cloud" }))).toThrow(/unknown type/i);
  });

  it("applies the same rules to vision, media and headless connectors", () => {
    const registry = new MultimodalRegistry();
    registry.registerVisionConnector({
      id: "vis",
      name: "Vision",
      isAvailable: async () => true,
      analyzeImage: async () => "",
    });
    expect(() =>
      registry.registerVisionConnector({
        id: "vis",
        name: "Other",
        isAvailable: async () => true,
        analyzeImage: async () => "",
      }),
    ).toThrow(/already registered/i);

    expect(() =>
      registry.registerMediaConnector({ id: "m", name: "M" } as never),
    ).toThrow(/missing/i);
    expect(() =>
      registry.registerHeadlessConnector({ id: "", name: "H" } as never),
    ).toThrow(/non-empty id/i);
  });
});
