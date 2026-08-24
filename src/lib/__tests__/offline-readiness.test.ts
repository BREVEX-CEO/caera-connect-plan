import { describe, it, expect } from "vitest";
import {
  assessOffline,
  describeGap,
  isRuntimeAsset,
  type OfflineGap,
  type OfflineInputs,
} from "../offline/readiness";

/**
 * "Works offline" must mean it works offline.
 *
 * THE PROMISE THAT BREAKS AT THE WORST MOMENT. Offline readiness is four
 * separate facts — the shell is cached, the runtime is cached, weights are on
 * the device, and storage will not be reclaimed — and it is easy to check the
 * one that is convenient and report all four. A browser with flawless WebGPU
 * support and no downloaded model cannot answer a single question on a plane.
 * Its owner finds out at the moment there is no network left to fix it with.
 *
 * These tests exist to make the false positive impossible: `ready` may only be
 * true when every one of the four holds.
 */

const READY: OfflineInputs = {
  serviceWorkerActive: true,
  shellCachedEntries: 369,
  runtimeCached: true,
  models: [{ key: "wasm/qwen2.5-1.5b.gguf", bytes: 1_117_320_736, verified: true }],
  persistent: true,
};

describe("readiness is never claimed on a partial state", () => {
  it("is ready when all four facts hold", () => {
    const r = assessOffline(READY);
    expect(r.ready).toBe(true);
    expect(r.gaps).toEqual([]);
    expect(r.canOpenOffline).toBe(true);
    expect(r.canAnswerOffline).toBe(true);
  });

  it("is not ready with engine support but no downloaded model", () => {
    /*
     * THE CENTRAL CASE. Capability is not possession. This is the exact state
     * of a fresh install on a capable machine, and the one most likely to be
     * mislabelled "works offline".
     */
    const r = assessOffline({ ...READY, models: [] });
    expect(r.ready).toBe(false);
    expect(r.gaps).toContain("no_model");
    expect(r.canAnswerOffline, "claimed it could answer with no weights").toBe(false);
    // The app still opens — that half is true and is stated separately.
    expect(r.canOpenOffline).toBe(true);
    expect(r.summary).toMatch(/cannot answer yet/i);
  });

  it("is not ready when the downloaded model failed verification", () => {
    // A half-written GGUF is worse than none: it looks like readiness on disk.
    const r = assessOffline({
      ...READY,
      models: [{ key: "wasm/partial.gguf", bytes: 120_000_000, verified: false }],
    });
    expect(r.gaps).toContain("model_unverified");
    expect(r.gaps).not.toContain("no_model");
    expect(r.canAnswerOffline).toBe(false);
  });

  it("is not ready when a zero-byte model is present", () => {
    const r = assessOffline({
      ...READY,
      models: [{ key: "wasm/empty.gguf", bytes: 0, verified: true }],
    });
    expect(r.canAnswerOffline).toBe(false);
  });

  it("is not ready without the engine runtime, even with weights", () => {
    // Weights with no runtime to execute them answer nothing.
    const r = assessOffline({ ...READY, runtimeCached: false });
    expect(r.gaps).toContain("runtime_not_cached");
    expect(r.canAnswerOffline).toBe(false);
  });

  it("is not ready when storage can still be evicted", () => {
    /*
     * Everything is present and it may all be gone tomorrow with no notice and
     * no network to replace it. Reporting a coin flip as a fact is the failure.
     */
    const r = assessOffline({ ...READY, persistent: false });
    expect(r.ready).toBe(false);
    expect(r.gaps).toEqual(["storage_evictable"]);
    // Both halves genuinely work today, and the summary says so without
    // promising they will survive.
    expect(r.canAnswerOffline).toBe(true);
    expect(r.summary).toMatch(/not yet guaranteed to survive/i);
  });

  it("does not warn about eviction when there is nothing stored to evict", () => {
    const r = assessOffline({ ...READY, models: [], persistent: false });
    expect(r.gaps).not.toContain("storage_evictable");
  });

  it("is not ready with no service worker", () => {
    const r = assessOffline({ ...READY, serviceWorkerActive: false });
    expect(r.gaps).toContain("no_service_worker");
    expect(r.canOpenOffline).toBe(false);
  });

  it("reports an empty cache separately from a missing worker", () => {
    // Different problems with different remedies: one is a blocked browser,
    // the other is simply a first visit.
    const r = assessOffline({ ...READY, shellCachedEntries: 0 });
    expect(r.gaps).toContain("shell_not_cached");
    expect(r.gaps).not.toContain("no_service_worker");
  });

  it("does not double-report a missing worker as an empty cache", () => {
    const r = assessOffline({ ...READY, serviceWorkerActive: false, shellCachedEntries: 0 });
    expect(r.gaps).toContain("no_service_worker");
    expect(r.gaps).not.toContain("shell_not_cached");
  });
});

describe("every gap is reported at once", () => {
  it("names all of them rather than the first", () => {
    /*
     * Reporting one gap at a time sends the user round a loop — fix, discover
     * the next, fix, discover a third. Some of these can only be closed while
     * a network is still available, so the whole list has to arrive together.
     */
    const r = assessOffline({
      serviceWorkerActive: false,
      shellCachedEntries: 0,
      runtimeCached: false,
      models: [],
      persistent: false,
    });
    expect(r.gaps).toContain("no_service_worker");
    expect(r.gaps).toContain("runtime_not_cached");
    expect(r.gaps).toContain("no_model");
    expect(r.gaps.length).toBeGreaterThanOrEqual(3);
  });

  it("gives every gap a title and a real action", () => {
    const all: OfflineGap[] = [
      "no_service_worker",
      "shell_not_cached",
      "runtime_not_cached",
      "no_model",
      "model_unverified",
      "storage_evictable",
    ];
    for (const gap of all) {
      const { title, action } = describeGap(gap);
      expect(title.length, gap).toBeGreaterThan(10);
      // An "action" that does not tell you what to do is a restatement.
      expect(action.length, gap).toBeGreaterThan(30);
    }
  });

  it("names the route that works on a device which can never connect", () => {
    /*
     * This used to require the words "cannot happen offline", and that was the
     * honest thing to say while downloading was the ONLY way to obtain an
     * engine. It no longer is: an engine can be installed from a file with no
     * network at all, so the old sentence would now be a false statement that
     * a test was holding in place — and it is read by exactly the person it
     * would be wrong for, on the device that cannot do the download.
     *
     * Both routes must be named. Offering only the file import would be as
     * unhelpful for the ordinary online case as the reverse was for this one.
     */
    const { action } = describeGap("no_model");
    expect(action, "the offline route is not offered").toMatch(/from a file/i);
    expect(action, "the ordinary download route is not offered").toMatch(/download/i);
    expect(action, "the superseded claim is back").not.toMatch(/cannot happen offline/i);
  });
});

describe("the summary never overstates", () => {
  const cases: Array<[string, Partial<OfflineInputs>]> = [
    ["fully ready", {}],
    ["no model", { models: [] }],
    ["no runtime", { runtimeCached: false }],
    ["no worker", { serviceWorkerActive: false }],
    ["evictable", { persistent: false }],
    ["nothing at all", { serviceWorkerActive: false, runtimeCached: false, models: [] }],
  ];

  it.each(cases)("%s — never says it answers offline unless it can", (_label, patch) => {
    const r = assessOffline({ ...READY, ...patch });
    if (!r.canAnswerOffline) {
      // The phrase a user would read as "you can use this on a plane".
      expect(r.summary).not.toMatch(/it answers on this device/i);
    }
  });

  it("only the fully-ready state gets the unqualified sentence", () => {
    const ready = assessOffline(READY);
    expect(ready.summary).toMatch(/works with no connection/i);
    for (const [, patch] of cases.slice(1)) {
      expect(assessOffline({ ...READY, ...patch }).summary).not.toMatch(
        /works with no connection/i,
      );
    }
  });
});

describe("runtime asset detection", () => {
  it("recognises the engine runtime", () => {
    expect(isRuntimeAsset("https://app/assets/wllama.wasm")).toBe(true);
    expect(isRuntimeAsset("https://app/assets/wllama-abc123.wasm?v=1")).toBe(true);
    expect(isRuntimeAsset("https://app/assets/tokenizer.json")).toBe(true);
  });

  it("does not mistake ordinary assets for it", () => {
    expect(isRuntimeAsset("https://app/assets/index-abc.js")).toBe(false);
    expect(isRuntimeAsset("https://app/favicon.ico")).toBe(false);
  });
});

describe("the measurement layer never throws", () => {
  it("is separated from the policy so the policy stays pure", async () => {
    // `assessOffline` takes plain data and touches no browser API, which is
    // what lets every branch above be exercised at all.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/offline/readiness.ts", "utf8"),
    );
    expect(source).not.toMatch(/navigator\./);
    expect(source).not.toMatch(/\bcaches\b\s*\./);
  });
});
