import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * F-077: a device that already holds the verified weights needs no free room
 * for another copy. Only a download needs the headroom.
 */
vi.mock("@wllama/wllama", () => ({ Wllama: class {} }));
vi.mock("@wllama/wllama/esm/wasm/wllama.wasm?url", () => ({ default: "wllama.wasm" }));
vi.mock("../offline-release", () => ({
  OFFLINE_LABEL: "Offline Intelligence",
  formatSize: (bytes: number) => `${bytes} B`,
  offlineRelease: () => ({ releaseId: "release-1", totalBytes: 100, thinkingSuitable: false }),
}));

afterEach(() => vi.unstubAllGlobals());

async function probeWith(weights: Blob | null) {
  vi.stubGlobal("window", { localStorage: { getItem: () => null } });
  vi.stubGlobal("navigator", { storage: { estimate: async () => ({ quota: 50, usage: 0 }) } });
  const { BrowserWasmAdapter } = await import("../adapters/browser-wasm");
  return new BrowserWasmAdapter({ weightsProvider: async () => weights }).probe();
}

describe("storage headroom", () => {
  it("is not asked of weights already on this device", async () => {
    expect((await probeWith(new Blob(["x"]))).available).toBe(true);
  });

  it("is still asked of a download that has no room", async () => {
    const result = await probeWith(null);
    expect(result.available).toBe(false);
  });
});
