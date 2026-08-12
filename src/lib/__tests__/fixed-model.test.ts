import { describe, expect, it } from "vitest";
import {
  FIXED_MODEL,
  detectPlatform,
  formatBytes,
  resolveFixedModel,
  selectFixedModel,
  storagePreflight,
} from "@/lib/local/fixed-model";

describe("there is one model, and nothing chooses", () => {
  it("gives every platform the same weights", () => {
    // The claim being pinned: a phone and a laptop run the SAME model. When
    // they did not, the tool protocol that worked on one silently failed on the
    // other, and "OCADE operates your computer" was true only on some devices.
    for (const platform of ["windows", "macos", "linux", "android", "ios"] as const) {
      const spec = resolveFixedModel(platform);
      expect(spec.id).toBe(FIXED_MODEL.id);
      expect(spec.parameters).toBe(FIXED_MODEL.parameters);
      expect(spec.quantisation).toBe("Q4_K_M");
    }
  });

  it("is qwen3:4b, by id", () => {
    expect(FIXED_MODEL.id).toBe("qwen3:4b");
  });

  it("hosts it in a way each form factor can actually run", () => {
    // Ollama does not exist on Android or iOS, so a mobile build that asked for
    // an HTTP runtime could never start its engine. Same model, hosted
    // differently — a hosting difference, not a second model.
    expect(resolveFixedModel("windows").runtime).toBe("gguf_http");
    expect(resolveFixedModel("android").runtime).toBe("gguf_embedded");
    expect(resolveFixedModel("ios").runtime).toBe("gguf_embedded");
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
    { id: "qwen3:4b" },
    { id: "qwen3-coder:30b", sizeBytes: 18_556_700_761 },
    { id: "qwen3:14b", sizeBytes: 9_276_198_565 },
  ];

  it("chooses the configured model even when far larger ones are present", () => {
    const choice = selectFixedModel({ platform: "windows", installed });
    expect(choice.ok).toBe(true);
    expect(choice.modelId).toBe("qwen3:4b");
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
      installed: [{ id: "qwen3:4b", isCloudPointer: true }],
    });
    expect(choice.ok).toBe(false);
  });
});

describe("vision is a capability requirement, not a size preference", () => {
  it("substitutes an installed vision model only when an image is present", () => {
    const choice = selectFixedModel({
      platform: "windows",
      installed: [{ id: "qwen3:4b" }, { id: "qwen2.5vl:7b", vision: true }],
      visionRequired: true,
    });
    expect(choice.ok).toBe(true);
    expect(choice.modelId).toBe("qwen2.5vl:7b");
    expect(choice.basis).toBe("fixed_vision_substitute");
  });

  it("refuses rather than sending an image to a text-only model", () => {
    const choice = selectFixedModel({
      platform: "windows",
      installed: [{ id: "qwen3:4b" }],
      visionRequired: true,
    });
    expect(choice.ok).toBe(false);
    expect(choice.basis).toBe("vision_unavailable");
    expect(choice.reason).toMatch(/no engine on this device can read images/i);
  });
});

describe("storage refusal names the three numbers a person needs", () => {
  it("passes when there is genuinely room", () => {
    const decision = storagePreflight(FIXED_MODEL, 30_834_651_136);
    expect(decision.ok).toBe(true);
    expect(decision.shortfallBytes).toBe(0);
  });

  it("reports required, available and shortfall rather than just failing", () => {
    const decision = storagePreflight(FIXED_MODEL, 2_000_000_000);
    expect(decision.ok).toBe(false);
    expect(decision.requiredBytes).toBeGreaterThan(decision.availableBytes);
    expect(decision.shortfallBytes).toBe(decision.requiredBytes - decision.availableBytes);
    expect(decision.reason).toMatch(/short/i);
  });

  it("asks for more than the bare model size", () => {
    // Sizing the check at exactly the model size passes the preflight and then
    // fails at the final atomic rename, after gigabytes have been downloaded.
    const decision = storagePreflight(FIXED_MODEL, FIXED_MODEL.approxBytes);
    expect(decision.ok).toBe(false);
  });

  it("refuses when free space cannot be read at all", () => {
    expect(storagePreflight(FIXED_MODEL, Number.NaN).ok).toBe(false);
  });

  it("formats sizes for a person, not a machine", () => {
    expect(formatBytes(5_225_388_164)).toBe("4.9 GB");
    expect(formatBytes(0)).toBe("0 B");
  });
});
