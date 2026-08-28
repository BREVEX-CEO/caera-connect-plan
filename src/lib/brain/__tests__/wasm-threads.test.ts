import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { planThreads, readThreadOutcome, MAX_THREADS } from "../wasm-threads";

/**
 * The thread plan, and the fact about the library it rests on.
 *
 * The first group is the important one. The previous implementation believed
 * wllama needed a separate multi-thread binary that the package did not ship,
 * and reported "no multi-core engine" for a reason that had stopped being true.
 * These assert the claim against the INSTALLED PACKAGE rather than against a
 * memory of its documentation, so a future version that reintroduces a second
 * binary fails here instead of silently running on one core.
 */

const WLLAMA = "node_modules/@wllama/wllama";

describe("what the installed wllama actually ships", () => {
  it("ships exactly one WebAssembly binary", () => {
    const wasm = readdirSync(`${WLLAMA}/esm/wasm`).filter((name) => name.endsWith(".wasm"));
    expect(wasm).toEqual(["wllama.wasm"]);
  });

  it("has no separate multi-thread build to go looking for", () => {
    // The path the old code probed for. Its absence is not a deployment gap;
    // there is no such file in this version and there is not meant to be.
    expect(existsSync(`${WLLAMA}/esm/wasm/multi-thread`)).toBe(false);
    expect(existsSync(`${WLLAMA}/esm/wasm/wllama-mt.wasm`)).toBe(false);
  });

  it("treats multi-thread mode as a HEADER difference, not a different file", () => {
    /*
     * `serve:mt` is the library's own multithreaded example server. The only
     * thing it changes is the two isolation headers — same files, same binary.
     * That is the whole of what "multi-thread mode" means here, and it is why
     * the fix was headers rather than a vendored build.
     */
    const server = readFileSync(`${WLLAMA}/scripts/http_server.js`, "utf8");
    expect(server).toMatch(/Cross-Origin-Embedder-Policy/);
    expect(server).toMatch(/Cross-Origin-Opener-Policy/);
    expect(server).toMatch(/MULTITHREAD/);
  });

  it("decides threads at runtime from feature detection", () => {
    const source = readFileSync(`${WLLAMA}/esm/index.js`, "utf8");
    // useMultiThread = supportMultiThread && nbThreads > 1
    expect(source).toMatch(/useMultiThread\s*=\s*supportMultiThread\s*&&\s*nbThreads\s*>\s*1/);
    // And it exposes what it actually did, which is what we assert on later.
    expect(source).toMatch(/isMultithread\(\)/);
    expect(source).toMatch(/getNumThreads\(\)/);
  });

  it("still requires only `default` in its assets path config", () => {
    // The single/multi keys survive as OPTIONAL for backwards compatibility.
    const types = readFileSync(`${WLLAMA}/esm/wllama.d.ts`, "utf8");
    const block = /interface AssetsPathConfig \{([\s\S]*?)\}/.exec(types)![1];
    expect(block).toMatch(/^\s*default: string;/m);
    expect(block).toMatch(/'single-thread\/wllama\.wasm'\?: string;/);
    expect(block).toMatch(/'multi-thread\/wllama\.wasm'\?: string;/);
  });
});

describe("threads require isolation, and nothing else will do", () => {
  it("gives one thread to a page that is not cross-origin isolated", () => {
    const plan = planThreads({ cores: 16, isolated: false, sharedArrayBuffer: true });
    expect(plan.threads).toBe(1);
    expect(plan.multithreaded).toBe(false);
    expect(plan.because).toMatch(/isolated/i);
  });

  it("gives one thread when shared memory is absent, however isolated", () => {
    const plan = planThreads({ cores: 16, isolated: true, sharedArrayBuffer: false });
    expect(plan.threads).toBe(1);
    expect(plan.multithreaded).toBe(false);
  });

  it("gives real threads to an isolated page on a capable machine", () => {
    const plan = planThreads({ cores: 16, isolated: true, sharedArrayBuffer: true });
    expect(plan.multithreaded).toBe(true);
    expect(plan.threads).toBeGreaterThan(1);
  });
});

describe("the count itself", () => {
  it("takes about half the cores, leaving the rest to the page", () => {
    // An engine that takes every core makes the product it is part of feel
    // broken while it works.
    const plan = planThreads({ cores: 12, isolated: true, sharedArrayBuffer: true });
    expect(plan.threads).toBe(6);
  });

  it("never exceeds its stated ceiling on a very large machine", () => {
    const plan = planThreads({ cores: 128, isolated: true, sharedArrayBuffer: true });
    expect(plan.threads).toBe(MAX_THREADS);
  });

  it("holds a phone down, because its cores are not equal", () => {
    // hardwareConcurrency counts efficiency cores that are much slower, and a
    // throttled phone with six workers answers more slowly than one with two.
    const phone = planThreads({ cores: 8, mobile: true, isolated: true, sharedArrayBuffer: true });
    const desktop = planThreads({ cores: 8, isolated: true, sharedArrayBuffer: true });
    expect(phone.threads).toBeLessThanOrEqual(4);
    expect(phone.threads).toBeLessThanOrEqual(desktop.threads);
  });

  it("holds a low-memory device down harder than a low-core one", () => {
    // Each thread wants stack and heap in the same WebAssembly memory the
    // weights are already in.
    const plan = planThreads({
      cores: 16,
      deviceMemoryGb: 2,
      isolated: true,
      sharedArrayBuffer: true,
    });
    expect(plan.threads).toBeLessThanOrEqual(2);
  });

  it("gives one thread to a single-core device rather than pretending", () => {
    const plan = planThreads({ cores: 1, isolated: true, sharedArrayBuffer: true });
    expect(plan.threads).toBe(1);
    expect(plan.multithreaded).toBe(false);
    expect(plan.because).toMatch(/single processor core/i);
  });

  it("is honest when the browser will not say how many cores it has", () => {
    const plan = planThreads({ cores: null, isolated: true, sharedArrayBuffer: true });
    expect(plan.threads).toBe(1);
    expect(plan.because).toMatch(/will not say/i);
  });

  it("never returns a count outside its bounds, whatever it is told", () => {
    const hostile = [
      { cores: Number.NaN },
      { cores: -8 },
      { cores: Number.POSITIVE_INFINITY },
      { cores: 0 },
      { cores: 3, deviceMemoryGb: 0.5 },
      {},
    ];
    for (const signals of hostile) {
      const plan = planThreads({ ...signals, isolated: true, sharedArrayBuffer: true });
      expect(plan.threads).toBeGreaterThanOrEqual(1);
      expect(plan.threads).toBeLessThanOrEqual(MAX_THREADS);
      expect(Number.isInteger(plan.threads)).toBe(true);
    }
  });

  it("keeps `multithreaded` and `threads` in agreement", () => {
    // A "multithreaded" plan of one thread would be a half-state nobody can
    // act on; wllama disables pthreads entirely at one, so this must not lie.
    for (const cores of [1, 2, 3, 4, 8, 16, 64]) {
      for (const mobile of [true, false]) {
        const plan = planThreads({ cores, mobile, isolated: true, sharedArrayBuffer: true });
        expect(plan.multithreaded).toBe(plan.threads > 1);
      }
    }
  });
});

describe("what the runtime did is asked, not assumed", () => {
  it("reports the runtime's own answer", () => {
    const outcome = readThreadOutcome({
      isMultithread: () => true,
      getNumThreads: () => 4,
    });
    expect(outcome).toEqual({ multithreaded: true, threads: 4 });
  });

  it("falls back to one thread when the runtime refuses to answer", () => {
    /*
     * `isMultithread()` throws before a model is loaded. The conservative
     * answer is the honest one — claiming four threads on a device running one
     * is how a diagnostic surface starts lying.
     */
    const outcome = readThreadOutcome({
      isMultithread: () => {
        throw new Error("model not loaded");
      },
    });
    expect(outcome).toEqual({ multithreaded: false, threads: 1 });
  });

  it("survives a runtime that exposes neither method", () => {
    expect(readThreadOutcome({})).toEqual({ multithreaded: false, threads: 1 });
  });

  it("does not report a nonsense thread count", () => {
    const outcome = readThreadOutcome({
      isMultithread: () => true,
      getNumThreads: () => Number.NaN,
    });
    expect(outcome.threads).toBe(1);
  });
});
