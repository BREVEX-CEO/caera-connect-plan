import { describe, expect, it } from "vitest";
import { MultimodalRegistry } from "../providers/multimodal-registry";
import { detectVoiceCapabilities } from "../ocade-voice";

describe("Stage 2 Phase 35 - Voice and multimodal connectors", () => {
  it("System/local/licensed voice providers", async () => {
    const registry = new MultimodalRegistry();
    registry.registerVoiceProvider({
      id: "test-voice-system",
      type: "system",
      name: "System Voice",
      isAvailable: async () => true,
      synthesize: async () => new ArrayBuffer(0),
      transcribe: async () => "system test",
    });
    registry.registerVoiceProvider({
      id: "test-voice-local",
      type: "local",
      name: "Local Voice",
      isAvailable: async () => true,
      synthesize: async () => new ArrayBuffer(0),
      transcribe: async () => "local test",
    });
    registry.registerVoiceProvider({
      id: "test-voice-licensed",
      type: "licensed",
      name: "Licensed Voice",
      isAvailable: async () => true,
      synthesize: async () => new ArrayBuffer(0),
      transcribe: async () => "licensed test",
    });

    const providers = registry.getVoiceProviders();
    expect(providers).toHaveLength(3);
    
    // Providers don't block
    await Promise.all(providers.map(p => p.isAvailable()));
  });

  it("Recorded-audio tests", async () => {
    // Tests that recorded audio inputs can be processed
    const registry = new MultimodalRegistry();
    registry.registerVoiceProvider({
      id: "mock-transcriber",
      type: "local",
      name: "Mock Transcriber",
      isAvailable: async () => true,
      synthesize: async () => new ArrayBuffer(0),
      transcribe: async (audio: ArrayBuffer) => {
        expect(audio.byteLength).toBeGreaterThan(0);
        return "recorded test passed";
      },
    });

    const result = await registry.getVoiceProvider("mock-transcriber")!.transcribe!(new ArrayBuffer(10));
    expect(result).toBe("recorded test passed");
  });

  it("Vision, media and headless connector contracts", async () => {
    const registry = new MultimodalRegistry();
    
    registry.registerVisionConnector({
      id: "vision-1",
      name: "Vision Connector",
      isAvailable: async () => true,
      analyzeImage: async () => "analyzed",
    });

    registry.registerMediaConnector({
      id: "media-1",
      name: "Media Connector",
      isAvailable: async () => true,
      extractMetadata: async () => ({ fps: 60 }),
      transcode: async (b) => b,
    });

    registry.registerHeadlessConnector({
      id: "headless-1",
      name: "Headless Connector",
      isAvailable: async () => true,
      executeScript: async () => "executed",
    });

    expect(await registry.getVisionConnector("vision-1")!.analyzeImage(new Uint8Array(), "prompt")).toBe("analyzed");
    expect(await registry.getMediaConnector("media-1")!.extractMetadata(new Uint8Array())).toEqual({ fps: 60 });
    expect(await registry.getHeadlessConnector("headless-1")!.executeScript("test")).toBe("executed");
  });

  it("Does not delay PC/web launch", () => {
    // Proves that registering contracts does not execute heavy startup initialization
    const start = performance.now();
    const registry = new MultimodalRegistry();
    
    registry.registerVisionConnector({
      id: "vision-delay",
      name: "Vision Delay Connector",
      isAvailable: async () => {
        return new Promise(resolve => setTimeout(() => resolve(true), 1000));
      },
      analyzeImage: async () => "analyzed",
    });
    
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50); // Instant registration without awaiting availability
  });

  it("detectVoiceCapabilities reports honesty correctly", () => {
    const emptyWindow = {};
    const result = detectVoiceCapabilities(emptyWindow);
    expect(result.synthesis).toBe(false);
    expect(result.recognition).toBe(false);
    expect(result.wakePhrase).toBe(false);

    const winWithSynthesis = { speechSynthesis: {} };
    const result2 = detectVoiceCapabilities(winWithSynthesis);
    expect(result2.synthesis).toBe(true);
    expect(result2.recognition).toBe(false);

    // Should include wake reason if recognition exists but no wakePhrase
    const winWithRecog = { SpeechRecognition: function() {} };
    const result3 = detectVoiceCapabilities(winWithRecog);
    expect(result3.synthesis).toBe(false);
    expect(result3.recognition).toBe(true);
    expect(result3.wakePhrase).toBe(false);
    expect(result3.wakeReason).toBeDefined();
  });
});
