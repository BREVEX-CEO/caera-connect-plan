import { describe, it, expect } from "vitest";
import {
  parseParamsB,
  classifyLocalModel,
  pickLocalModel,
  buildLocalFirstPlan,
  discoverLocalModels,
  type LocalModelInfo,
  type RawLocalModel,
} from "../ocade-local";
import { leaksRawModelIdentity } from "../ocade-capability-labels";

describe("parseParamsB", () => {
  it.each([
    ["7.6B", 7.6],
    ["30.5B", 30.5],
    ["7B", 7],
    ["800M", 0.8],
  ])("parses %s → %s", (s, n) => expect(parseParamsB(s)).toBeCloseTo(n));
  it("returns null for missing/garbage", () => {
    expect(parseParamsB(undefined)).toBeNull();
    expect(parseParamsB("huge")).toBeNull();
  });
});

describe("classifyLocalModel", () => {
  it("maps real installed code models to OCADE Local Code", () => {
    const m = classifyLocalModel({
      name: "qwen2.5-coder:7b",
      size: 4.4e9,
      details: { family: "qwen2", parameter_size: "7.6B" },
    });
    expect(m.profile).toBe("code");
    expect(m.label).toBe("OCADE Local Code");
    expect(m.vision).toBe(false);
    expect(m.isCloudPointer).toBe(false);
  });

  it.each<[string, RawLocalModel, string]>([
    [
      "vision",
      { name: "llava:13b", size: 8e9, details: { parameter_size: "13B" } },
      "OCADE Local Vision",
    ],
    [
      "fast",
      { name: "phi3:3.8b", size: 2e9, details: { parameter_size: "3.8B" } },
      "OCADE Local Fast",
    ],
    [
      "general",
      { name: "llama3.1:8b", size: 5e9, details: { parameter_size: "8B" } },
      "OCADE Local",
    ],
  ])("classifies %s → %s", (_p, raw, label) => {
    expect(classifyLocalModel(raw).label).toBe(label);
  });

  it("flags a :cloud pointer as not on-device", () => {
    expect(classifyLocalModel({ name: "deepseek-v4-pro:cloud", size: 0 }).isCloudPointer).toBe(
      true,
    );
  });

  it("never surfaces the raw model name in the capability label", () => {
    const m = classifyLocalModel({
      name: "qwen2.5-coder:7b",
      size: 4.4e9,
      details: { parameter_size: "7.6B" },
    });
    expect(leaksRawModelIdentity(m.label)).toBe(false);
  });
});

const CODE_MODELS: LocalModelInfo[] = [
  classifyLocalModel({
    name: "qwen3-coder:30b",
    size: 17.3e9,
    details: { parameter_size: "30.5B" },
  }),
  classifyLocalModel({
    name: "qwen2.5-coder:7b",
    size: 4.4e9,
    details: { parameter_size: "7.6B" },
  }),
  classifyLocalModel({
    name: "deepseek-coder:6.7b",
    size: 3.6e9,
    details: { parameter_size: "7B" },
  }),
];

describe("pickLocalModel", () => {
  it("prefers the largest model for a code request", () => {
    expect(pickLocalModel(CODE_MODELS, "code")?.id).toBe("qwen3-coder:30b");
  });
  it("serves a general request from available code models (they can chat)", () => {
    expect(pickLocalModel(CODE_MODELS, "general")?.id).toBe("qwen3-coder:30b");
  });
  it("returns null for a vision request when no vision model is installed", () => {
    expect(pickLocalModel(CODE_MODELS, "vision")).toBeNull();
  });
  it("prefers the smallest model for a fast request", () => {
    expect(pickLocalModel(CODE_MODELS, "fast")?.id).toBe("deepseek-coder:6.7b");
  });
});

describe("buildLocalFirstPlan", () => {
  it("orders local → cloud with an explicit ask-before-cloud step", () => {
    const plan = buildLocalFirstPlan({
      desired: "general",
      models: CODE_MODELS,
      cloudAllowed: true,
      online: true,
    });
    const kinds = plan.map((s) => s.kind);
    expect(kinds[0]).toBe("local_preferred");
    expect(kinds).toContain("local_reduced");
    expect(kinds).toContain("ask_cloud");
    expect(kinds.indexOf("local_reduced")).toBeLessThan(kinds.indexOf("ask_cloud"));
    expect(kinds).not.toContain("fail");
  });

  it("offers only cloud (with approval) when no local model is installed", () => {
    const plan = buildLocalFirstPlan({
      desired: "general",
      models: [],
      cloudAllowed: true,
      online: true,
    });
    expect(plan.map((s) => s.kind)).toEqual(["ask_cloud"]);
  });

  it("fails honestly when offline with no local model and no cloud", () => {
    const plan = buildLocalFirstPlan({
      desired: "general",
      models: [],
      cloudAllowed: false,
      online: false,
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe("fail");
  });

  it("never emits a raw model name in a step label", () => {
    const plan = buildLocalFirstPlan({
      desired: "code",
      models: CODE_MODELS,
      cloudAllowed: true,
      online: true,
    });
    for (const step of plan) {
      if (step.label) expect(leaksRawModelIdentity(step.label)).toBe(false);
    }
  });
});

describe("discoverLocalModels (injected fetch)", () => {
  const fakeFetch = (bodyByPath: Record<string, unknown>) =>
    ((url: string) => {
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      const body = bodyByPath[path];
      if (body === undefined) return Promise.resolve(new Response("not found", { status: 404 }));
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }) as unknown as (input: string, init?: RequestInit) => Promise<Response>;

  it("parses health + tags and drops cloud pointers", async () => {
    const f = fakeFetch({
      "/api/version": { version: "0.30.11" },
      "/api/tags": {
        models: [
          { name: "qwen2.5-coder:7b", size: 4.4e9, details: { parameter_size: "7.6B" } },
          { name: "deepseek-v4-pro:cloud", size: 0 },
        ],
      },
    });
    const d = await discoverLocalModels("http://localhost:11434", f);
    expect(d.ok).toBe(true);
    expect(d.reachable).toBe(true);
    expect(d.version).toBe("0.30.11");
    expect(d.models).toHaveLength(1);
    expect(d.models[0].label).toBe("OCADE Local Code");
  });

  it("reports unreachable honestly when the bridge is down", async () => {
    const f = (() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as (
      input: string,
      init?: RequestInit,
    ) => Promise<Response>;
    const d = await discoverLocalModels("http://localhost:11434", f);
    expect(d.ok).toBe(false);
    expect(d.reachable).toBe(false);
    expect(d.reason).toBeTruthy();
  });
});
