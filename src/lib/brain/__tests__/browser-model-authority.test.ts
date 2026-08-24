/**
 * ONE AUTHORITY, AND IT HAS TO STAY TRUE.
 *
 * `browser-catalogue.ts` states how much memory a WebGPU tier needs and how
 * large a context OCADE runs it with. The library that actually loads the
 * weights publishes both of those numbers itself. Nothing was comparing them.
 *
 * They had already drifted: the catalogue once claimed 1880 MB for a tier
 * beside a comment saying the figure came from the publisher, who published
 * 1629.75 — 250 MB of hand-typed pessimism presented as a fact. It happened to
 * be harmless because it only ever excluded a tier. The context window was the
 * dangerous one: OCADE sizes its compiled system prompt against
 * `contextTokens`, and nothing told the runtime, so the budget was right by
 * coincidence and a library bump could have truncated OCADE's own rules out of
 * the window with every test still green.
 *
 * These tests fail on the version bump rather than on the incident.
 */
import { describe, expect, it } from "vitest";
import { prebuiltAppConfig } from "@mlc-ai/web-llm";
import {
  MEMORY_HEADROOM_FRACTION,
  WASM_TIERS,
  WEBGPU_TIERS,
  runtimeMemoryBytes,
  systemPromptBudgetFor,
  webgpuMirrorFileUrl,
  webgpuMirrorWeightsUrl,
} from "../browser-catalogue";

const MB = 1024 * 1024;
const ALL = [...WEBGPU_TIERS, ...WASM_TIERS];

describe("the WebGPU tiers agree with the runtime that loads them", () => {
  it("names a model this build of the runtime actually has", () => {
    for (const tier of WEBGPU_TIERS) {
      expect(
        prebuiltAppConfig.model_list.some((m) => m.model_id === tier.webllmId),
        `${tier.label} (${tier.webllmId}) is not in this runtime build`,
      ).toBe(true);
    }
  });

  it("states the publisher's own memory requirement, to within a megabyte", () => {
    for (const tier of WEBGPU_TIERS) {
      const record = prebuiltAppConfig.model_list.find((m) => m.model_id === tier.webllmId)!;
      const published = (record.vram_required_MB ?? 0) * MB;
      expect(
        Math.abs(tier.requiredMemoryBytes - published),
        `${tier.label}: catalogue says ${(tier.requiredMemoryBytes / MB).toFixed(2)} MB, runtime publishes ${record.vram_required_MB} MB`,
      ).toBeLessThan(MB);
    }
  });

  it("applies headroom once, visibly, rather than hiding it inside the fact", () => {
    for (const tier of WEBGPU_TIERS) {
      expect(runtimeMemoryBytes(tier)).toBe(
        Math.round(tier.requiredMemoryBytes * (1 + MEMORY_HEADROOM_FRACTION)),
      );
      expect(runtimeMemoryBytes(tier)).toBeGreaterThan(tier.requiredMemoryBytes);
    }
  });

  it("does not run a tier at a context the runtime was not configured for", () => {
    for (const tier of WEBGPU_TIERS) {
      const record = prebuiltAppConfig.model_list.find((m) => m.model_id === tier.webllmId)!;
      const runtimeContext = record.overrides?.context_window_size;
      // The adapter overrides this explicitly. If the runtime's own record ever
      // disagrees, that is a decision to re-take deliberately, not to inherit.
      expect(
        runtimeContext,
        `${tier.label}: runtime record says ${runtimeContext}, catalogue says ${tier.contextTokens}`,
      ).toBe(tier.contextTokens);
    }
  });
});

describe("every tier carries the facts the product depends on", () => {
  it("has an immutable version that identifies the exact weights", () => {
    const seen = new Set<string>();
    for (const tier of ALL) {
      expect(tier.version, `${tier.label} has no version`).toMatch(/^[a-z0-9][a-z0-9._-]*$/);
      expect(seen.has(tier.version), `${tier.version} is used twice`).toBe(false);
      seen.add(tier.version);
    }
  });

  it("leaves room for a conversation after the system prompt", () => {
    for (const tier of ALL) {
      const budget = systemPromptBudgetFor(tier);
      expect(budget).toBeGreaterThan(0);
      expect(budget).toBeLessThan(tier.contextTokens / 2);
    }
  });

  it("says outright which tiers Thinking is worth running on", () => {
    for (const tier of ALL) expect(typeof tier.thinkingSuitable).toBe("boolean");
    // The processor-only fallback is the one that must not deliberate.
    expect(WASM_TIERS.every((t) => t.thinkingSuitable)).toBe(false);
  });
});

describe("a deployment can serve the WebGPU weights itself", () => {
  it("offers a versioned same-origin location for every WebGPU tier", () => {
    for (const tier of WEBGPU_TIERS) {
      const base = webgpuMirrorWeightsUrl(tier);
      expect(base).toBe(`/models/webllm/${tier.version}`);
    }
  });

  it("mirrors a runtime file under that version, by filename only", () => {
    const tier = WEBGPU_TIERS[0];
    expect(
      webgpuMirrorFileUrl(
        tier,
        "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
      ),
    ).toBe(`/models/webllm/${tier.version}/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`);
  });

  it("refuses a path that would climb out of the mirror directory", () => {
    const tier = WEBGPU_TIERS[0];
    for (const hostile of [
      "https://evil.test/a/../../etc/passwd",
      "https://evil.test/",
      "https://evil.test/.hidden",
      "https://evil.test/dir/",
    ]) {
      const mirrored = webgpuMirrorFileUrl(tier, hostile);
      if (mirrored !== null) {
        expect(mirrored.startsWith(`/models/webllm/${tier.version}/`)).toBe(true);
        expect(mirrored).not.toContain("..");
      }
    }
  });

  it("keeps the WebAssembly tier's own mirror separate from the WebGPU one", () => {
    for (const tier of WASM_TIERS) expect(webgpuMirrorWeightsUrl(tier)).toBeNull();
  });
});
