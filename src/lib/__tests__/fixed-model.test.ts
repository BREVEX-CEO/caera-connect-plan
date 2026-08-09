import { describe, expect, it } from "vitest";
import {
  FIXED_DESKTOP_MODEL,
  FIXED_MOBILE_MODEL,
  detectPlatform,
  formatBytes,
  resolveFixedModel,
  selectFixedModel,
  storagePreflight,
} from "@/lib/local/fixed-model";

describe("the fixed model is decided by platform and nothing else", () => {
  it("gives every desktop platform the same model", () => {
    for (const platform of ["windows", "macos", "linux"] as const) {
      expect(resolveFixedModel(platform)).toBe(FIXED_DESKTOP_MODEL);
    }
  });

  it("gives every mobile platform the same model", () => {
    for (const platform of ["android", "ios"] as const) {
      expect(resolveFixedModel(platform)).toBe(FIXED_MOBILE_MODEL);
    }
  });

  it("uses a runtime family a phone can actually host", () => {
    // Ollama does not exist on Android or iOS. A mobile spec that asked for an
    // HTTP runtime would ship a build that can never start its engine.
    expect(FIXED_MOBILE_MODEL.runtime).toBe("gguf_embedded");
    expect(FIXED_DESKTOP_MODEL.runtime).toBe("gguf_http");
  });

  it("puts Capacitor ahead of every browser-shaped signal", () => {
    // A phone in a web view answers "desktop" to every other check, and would
    // be handed a 5 GB download it cannot take.
    expect(
      detectPlatform({ capacitorPlatform: "android", nodePlatform: "win32", userAgent: "Windows" }),
    ).toBe("android");
  });
});

describe("selection ignores size, memory and speed", () => {
  const installed = [
    { id: "qwen3:8b" },
    { id: "qwen3-coder:30b", sizeBytes: 18_556_700_761 },
    { id: "qwen3:14b", sizeBytes: 9_276_198_565 },
  ];

  it("chooses the configured model even when far larger ones are present", () => {
    const choice = selectFixedModel({ platform: "windows", installed });
    expect(choice.ok).toBe(true);
    expect(choice.modelId).toBe("qwen3:8b");
    expect(choice.basis).toBe("fixed");
  });

  it("explains the models it did not choose, without ranking them", () => {
    const choice = selectFixedModel({ platform: "windows", installed });
    expect(choice.notChosen.map((m) => m.modelId)).toEqual(["qwen3-coder:30b", "qwen3:14b"]);
    for (const row of choice.notChosen) {
      expect(row.why).toMatch(/always uses its own configured engine/i);
    }
  });

  it("refuses honestly when its own model is missing", () => {
    const choice = selectFixedModel({ platform: "windows", installed: [{ id: "qwen3:14b" }] });
    expect(choice.ok).toBe(false);
    expect(choice.basis).toBe("not_installed");
    expect(choice.reason).toMatch(/not installed/i);
  });

  it("never routes to a cloud pointer", () => {
    const choice = selectFixedModel({
      platform: "windows",
      installed: [{ id: "qwen3:8b", isCloudPointer: true }],
    });
    expect(choice.ok).toBe(false);
  });
});

describe("vision is a capability requirement, not a size preference", () => {
  it("substitutes an installed vision model only when an image is present", () => {
    const choice = selectFixedModel({
      platform: "windows",
      installed: [{ id: "qwen3:8b" }, { id: "qwen2.5vl:7b", vision: true }],
      visionRequired: true,
    });
    expect(choice.ok).toBe(true);
    expect(choice.modelId).toBe("qwen2.5vl:7b");
    expect(choice.basis).toBe("fixed_vision_substitute");
  });

  it("refuses rather than sending an image to a text-only model", () => {
    const choice = selectFixedModel({
      platform: "windows",
      installed: [{ id: "qwen3:8b" }],
      visionRequired: true,
    });
    expect(choice.ok).toBe(false);
    expect(choice.basis).toBe("vision_unavailable");
    expect(choice.reason).toMatch(/no engine on this device can read images/i);
  });
});

describe("storage refusal names the three numbers a person needs", () => {
  it("passes when there is genuinely room", () => {
    const decision = storagePreflight(FIXED_DESKTOP_MODEL, 30_834_651_136);
    expect(decision.ok).toBe(true);
    expect(decision.shortfallBytes).toBe(0);
  });

  it("reports required, available and shortfall rather than just failing", () => {
    const decision = storagePreflight(FIXED_DESKTOP_MODEL, 2_000_000_000);
    expect(decision.ok).toBe(false);
    expect(decision.requiredBytes).toBeGreaterThan(decision.availableBytes);
    expect(decision.shortfallBytes).toBe(decision.requiredBytes - decision.availableBytes);
    expect(decision.reason).toMatch(/short/i);
  });

  it("asks for more than the bare model size", () => {
    // Sizing the check at exactly the model size passes the preflight and then
    // fails at the final atomic rename, after gigabytes have been downloaded.
    const decision = storagePreflight(FIXED_DESKTOP_MODEL, FIXED_DESKTOP_MODEL.approxBytes);
    expect(decision.ok).toBe(false);
  });

  it("refuses when free space cannot be read at all", () => {
    expect(storagePreflight(FIXED_DESKTOP_MODEL, Number.NaN).ok).toBe(false);
  });

  it("formats sizes for a person, not a machine", () => {
    expect(formatBytes(5_225_388_164)).toBe("4.9 GB");
    expect(formatBytes(0)).toBe("0 B");
  });
});
