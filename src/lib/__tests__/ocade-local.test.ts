import { describe, it, expect } from "vitest";
import {
  parseParamsB,
  classifyLocalModel,
  pickLocalModel,
  pickLocalModelForHardware,
  modelFit,
  buildLocalFirstPlan,
  discoverLocalModels,
  MODEL_RAM_OVERHEAD,
  TOTAL_RAM_HEADROOM,
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

  /*
   * These cases come from a real installation, not from imagination. The
   * runtime reports `capabilities: ["vision", "completion"]` for
   * `qwen2.5vl:7b` while its family is "qwen25vl" and its name contains no
   * hyphen before "vl" — so every name/family heuristic missed it and OCADE
   * refused image questions on a machine that could answer them.
   */
  it("trusts the runtime's declared vision capability over any name heuristic", () => {
    const m = classifyLocalModel({
      name: "qwen2.5vl:7b",
      size: 5.97e9,
      details: { family: "qwen25vl", families: ["qwen25vl"], parameter_size: "8.3B" },
      capabilities: ["vision", "completion"],
    });
    expect(m.vision).toBe(true);
    expect(m.profile).toBe("vision");
    expect(m.label).toBe("OCADE Local Vision");
  });

  it("recognises that same model by name shape when the runtime declares nothing", () => {
    const m = classifyLocalModel({
      name: "qwen2.5vl:7b",
      size: 5.97e9,
      details: { family: "qwen25vl", families: ["qwen25vl"], parameter_size: "8.3B" },
    });
    expect(m.vision).toBe(true);
  });

  it("does NOT overrule a runtime that lists capabilities without vision", () => {
    // A name-shaped false positive must lose to the runtime's own statement:
    // sending images to a text-only model yields a confident answer about
    // nothing, which is worse than refusing.
    const m = classifyLocalModel({
      name: "vision-tuned-writer:7b",
      size: 4e9,
      details: { parameter_size: "7B" },
      capabilities: ["completion", "tools"],
    });
    expect(m.vision).toBe(false);
    expect(m.profile).not.toBe("vision");
  });

  it.each(["internvl2:8b", "pixtral:12b", "llava:7b", "minicpm-v:8b"])(
    "still classifies %s as vision without any declared capability",
    (name) => {
      expect(classifyLocalModel({ name, size: 5e9 }).vision).toBe(true);
    },
  );

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

  /*
   * These four cover a defect observed on a real machine: nine models were
   * installed and the engine was serving, but discovery shared ONE deadline
   * across two probes, the first was briefly slow after loading a 6 GB model,
   * and the product told the user "No on-device engine is installed" — a false
   * statement about their own computer, on the strength of a 4-second budget.
   */
  const abort = () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    return Promise.reject(error);
  };

  it("still finds models when the cosmetic version probe fails outright", async () => {
    const f = ((url: string) =>
      url.endsWith("/api/version")
        ? Promise.reject(new Error("ECONNRESET"))
        : Promise.resolve(
            new Response(
              JSON.stringify({
                models: [{ name: "qwen3:8b", size: 5.2e9, details: { parameter_size: "8.2B" } }],
              }),
              { status: 200 },
            ),
          )) as unknown as (input: string, init?: RequestInit) => Promise<Response>;
    const d = await discoverLocalModels("http://localhost:11434", f);
    expect(d.ok).toBe(true);
    expect(d.models).toHaveLength(1);
    expect(d.version).toBeUndefined();
  });

  it("retries the model list once after a timeout and succeeds", async () => {
    let tagCalls = 0;
    const f = ((url: string) => {
      if (url.endsWith("/api/version")) {
        return Promise.resolve(
          new Response(JSON.stringify({ version: "0.30.11" }), { status: 200 }),
        );
      }
      tagCalls += 1;
      if (tagCalls === 1) return abort();
      return Promise.resolve(
        new Response(
          JSON.stringify({
            models: [{ name: "qwen3:8b", size: 5.2e9, details: { parameter_size: "8.2B" } }],
          }),
          { status: 200 },
        ),
      );
    }) as unknown as (input: string, init?: RequestInit) => Promise<Response>;
    const d = await discoverLocalModels("http://localhost:11434", f);
    expect(tagCalls).toBe(2);
    expect(d.ok).toBe(true);
    expect(d.models).toHaveLength(1);
  });

  it("does NOT retry a refused connection — nothing is listening, so waiting is pointless", async () => {
    let tagCalls = 0;
    const f = ((url: string) => {
      if (url.endsWith("/api/version")) return Promise.reject(new Error("ECONNREFUSED"));
      tagCalls += 1;
      return Promise.reject(new Error("ECONNREFUSED"));
    }) as unknown as (input: string, init?: RequestInit) => Promise<Response>;
    const d = await discoverLocalModels("http://localhost:11434", f);
    expect(tagCalls).toBe(1);
    expect(d.reachable).toBe(false);
    expect(d.reason).toMatch(/unreachable/i);
  });

  it("calls a persistent timeout busy, not missing, because something IS listening", async () => {
    const f = ((url: string) =>
      url.endsWith("/api/version")
        ? Promise.resolve(new Response(JSON.stringify({ version: "0.30.11" }), { status: 200 }))
        : abort()) as unknown as (input: string, init?: RequestInit) => Promise<Response>;
    const d = await discoverLocalModels("http://localhost:11434", f);
    expect(d.ok).toBe(false);
    expect(d.reachable).toBe(true);
    expect(d.reason).toMatch(/still be loading a model/i);
    // The claim "no engine installed" must never be produced by a timeout.
    expect(d.reason).not.toMatch(/not installed|no on-device models/i);
  });
});

/*
 * Hardware-aware selection.
 *
 * These numbers are not invented: they are the three models actually installed
 * on the machine where this was found, and the RAM that machine actually has.
 * `pickLocalModel` returned qwen3-coder:30b (18.56 GB) for "code" on a 16.8 GB
 * machine — a model that cannot be resident. Runtime evidence caught it; these
 * tests keep it caught.
 */
const REAL_MACHINE_RAM = 16_801_841_152; // 15.65 GiB, measured
const model = (id: string, sizeBytes: number, paramsB: number): LocalModelInfo =>
  classifyLocalModel({
    name: id,
    size: sizeBytes,
    details: { parameter_size: `${paramsB}B` },
  });

const DEEPSEEK_67 = model("deepseek-coder:6.7b", 3_830_000_000, 7);
const QWEN25_7 = model("qwen2.5-coder:7b", 4_680_000_000, 7.6);
const QWEN3_30 = model("qwen3-coder:30b", 18_560_000_000, 30.5);
const INSTALLED = [DEEPSEEK_67, QWEN3_30, QWEN25_7];

describe("modelFit", () => {
  it("estimates resident bytes as file size plus overhead", () => {
    const f = modelFit(DEEPSEEK_67, REAL_MACHINE_RAM);
    expect(f.needsBytes).toBe(Math.round(3_830_000_000 * MODEL_RAM_OVERHEAD));
    expect(f.fits).toBe(true);
  });

  it("rejects a model larger than the machine, and says why in real units", () => {
    const f = modelFit(QWEN3_30, REAL_MACHINE_RAM);
    expect(f.fits).toBe(false);
    expect(f.reason).toContain("qwen3-coder:30b");
    expect(f.reason).toMatch(/22\.3 GB/); // 18.56 * 1.2
    expect(f.reason).toMatch(/16\.8 GB/); // the machine
  });

  it("respects the headroom constant rather than using all of RAM", () => {
    // A model needing exactly the full RAM must NOT fit — headroom is the point.
    const exact = model("exact:1", REAL_MACHINE_RAM / MODEL_RAM_OVERHEAD, 1);
    expect(modelFit(exact, REAL_MACHINE_RAM).fits).toBe(false);

    // Just under the ceiling fits. Not exactly AT it: needsBytes is rounded, so
    // an exact-ceiling model lands a fraction of a byte either side depending on
    // float error, and a test that flips on rounding noise tests nothing.
    const ceilingBytes = REAL_MACHINE_RAM * TOTAL_RAM_HEADROOM;
    const justUnder = model("under:1", (ceilingBytes - 1_000_000) / MODEL_RAM_OVERHEAD, 1);
    expect(modelFit(justUnder, REAL_MACHINE_RAM).fits).toBe(true);

    const justOver = model("over:1", (ceilingBytes + 1_000_000) / MODEL_RAM_OVERHEAD, 1);
    expect(modelFit(justOver, REAL_MACHINE_RAM).fits).toBe(false);
  });

  it("does not guess when hardware is undetectable", () => {
    // Unknown RAM disables the check rather than inventing a limit.
    expect(modelFit(QWEN3_30, 0).fits).toBe(true);
    expect(modelFit(QWEN3_30, Number.NaN).fits).toBe(true);
  });
});

describe("pickLocalModelForHardware", () => {
  it("never returns a model this machine cannot hold — the real regression", () => {
    const plain = pickLocalModel(INSTALLED, "code");
    expect(plain?.id).toBe("qwen3-coder:30b"); // the old, hardware-blind answer

    const aware = pickLocalModelForHardware(INSTALLED, "code", REAL_MACHINE_RAM);
    expect(aware.picked?.id).toBe("qwen2.5-coder:7b"); // largest that actually fits
    expect(aware.excluded.map((e) => e.model.id)).toEqual(["qwen3-coder:30b"]);
  });

  it("still prefers the smallest for `fast`", () => {
    const aware = pickLocalModelForHardware(INSTALLED, "fast", REAL_MACHINE_RAM);
    expect(aware.picked?.id).toBe("deepseek-coder:6.7b");
  });

  it("refuses honestly when nothing installed fits", () => {
    const tiny = 2_000_000_000; // 2 GB machine
    const aware = pickLocalModelForHardware(INSTALLED, "code", tiny);
    expect(aware.picked).toBeNull();
    expect(aware.excluded).toHaveLength(3);
    expect(aware.reason).toMatch(/No installed model fits/);
  });

  it("distinguishes nothing-installed from nothing-fits", () => {
    const empty = pickLocalModelForHardware([], "code", REAL_MACHINE_RAM);
    expect(empty.reason).toMatch(/No on-device models are installed/);
  });
});

describe("buildLocalFirstPlan is hardware-aware", () => {
  it("drops unrunnable models from every step of the chain", () => {
    const chain = buildLocalFirstPlan({
      desired: "code",
      models: INSTALLED,
      cloudAllowed: false,
      online: true,
      totalRamBytes: REAL_MACHINE_RAM,
    });
    const ids = chain.map((s) => s.modelId).filter(Boolean);
    expect(ids).not.toContain("qwen3-coder:30b");
    expect(chain[0].modelId).toBe("qwen2.5-coder:7b");
  });

  it("keeps the old behaviour when RAM is unknown", () => {
    const chain = buildLocalFirstPlan({
      desired: "code",
      models: INSTALLED,
      cloudAllowed: false,
      online: true,
    });
    expect(chain[0].modelId).toBe("qwen3-coder:30b");
  });

  it("says models are too big rather than claiming none are installed", () => {
    const chain = buildLocalFirstPlan({
      desired: "code",
      models: INSTALLED,
      cloudAllowed: false,
      online: false,
      totalRamBytes: 2_000_000_000,
    });
    expect(chain).toHaveLength(1);
    expect(chain[0].kind).toBe("fail");
    expect(chain[0].detail).toMatch(/cannot run on this machine/);
    expect(chain[0].detail).not.toMatch(/no local engine is installed/i);
  });
});
