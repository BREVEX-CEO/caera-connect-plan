import { describe, it, expect } from "vitest";
import {
  parseParamsB,
  classifyLocalModel,
  modelFit,
  discoverLocalModels,
  MODEL_RAM_OVERHEAD,
  TOTAL_RAM_HEADROOM,
  type LocalModelInfo,
  type RawLocalModel,
} from "../ocade-local";
import * as ocadeLocal from "../ocade-local";
import { leaksRawModelIdentity } from "../ocade-capability-labels";
import { routeTask, PerfLedger } from "../local/router-policy";
import { OCADE_MODEL_ID } from "../local/fixed-model";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

/*
 * A machine like the reference laptop: the fixed engine installed alongside
 * several larger leftovers. This is the exact shape that used to break routing.
 */
const CLUTTERED_MACHINE: LocalModelInfo[] = [
  classifyLocalModel({ name: "qwen2.5:3b", size: 1.93e9, details: { parameter_size: "3.1B" } }),
  classifyLocalModel({ name: "qwen3:14b", size: 9.28e9, details: { parameter_size: "14.8B" } }),
  classifyLocalModel({ name: "qwen3:8b", size: 5.23e9, details: { parameter_size: "8.2B" } }),
  classifyLocalModel({
    name: "qwen2.5vl:7b",
    size: 5.97e9,
    details: { parameter_size: "8.3B", families: ["qwen25vl"] },
  }),
];

describe("one engine: size never decides what runs", () => {
  /*
   * THE REGRESSION THIS FILE EXISTS TO PREVENT.
   *
   * Signed-in Chat built a fallback chain and started at its first step, which
   * was the LARGEST installed model. On this machine shape that meant a 9.3 GB
   * engine served chat while Control + Work served the fixed 1.9 GB one.
   */
  it("routes a text request to the fixed engine, not the biggest installed model", () => {
    const route = routeTask("general", CLUTTERED_MACHINE, new PerfLedger(), {});
    expect(route.ok).toBe(true);
    if (!route.ok) return;
    expect(route.model.id).toBe(OCADE_MODEL_ID);
    expect(route.model.id).not.toBe("qwen3:14b");
  });

  it("routes an image request to the vision engine, the one allowed exception", () => {
    const route = routeTask("vision", CLUTTERED_MACHINE, new PerfLedger(), {});
    expect(route.ok).toBe(true);
    if (!route.ok) return;
    expect(route.model.vision).toBe(true);
  });

  it("keeps no size-ranking selector on the module", () => {
    const surface = ocadeLocal as Record<string, unknown>;
    for (const gone of ["pickLocalModel", "pickLocalModelForHardware", "buildLocalFirstPlan"]) {
      expect(surface[gone]).toBeUndefined();
    }
  });

  it("leaves no fallback chain in the signed-in chat route", () => {
    const source = readFileSync(
      resolve(__dirname, "../../routes/_authenticated/ocade.index.tsx"),
      "utf8",
    );
    expect(source).not.toContain("buildLocalFirstPlan");
    // The route must reach the single-model authority, not re-rank models itself.
    expect(source).toContain("routeTask(");
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

/*
 * The fallback chain must refuse what the primary route refused.
 *
 * `routeTask` already excludes a quarantined tier and a GPU-tier model on a
 * machine without acceleration. This chain did not, so falling back could hand
 * the user exactly the model that had just been rejected — and on the
 * reference machine that model needed roughly three minutes to produce a
 * one-word answer.
 */
