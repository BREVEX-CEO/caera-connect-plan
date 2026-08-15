import { describe, expect, it, vi } from "vitest";
import { primeOfflineRuntime } from "@/lib/offline/prime-runtime";

function dependencies(overrides: Partial<Parameters<typeof primeOfflineRuntime>[0]> = {}) {
  return {
    online: true,
    serviceWorkerSupported: true,
    waitForController: vi.fn().mockResolvedValue(true),
    loadRuntime: vi.fn().mockResolvedValue({ wasmUrl: "/assets/wllama.wasm" }),
    fetchAsset: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

describe("offline runtime priming", () => {
  it("loads and fetches the split runtime only after service-worker control", async () => {
    const calls: string[] = [];
    const deps = dependencies({
      waitForController: vi.fn(async () => {
        calls.push("controlled");
        return true;
      }),
      loadRuntime: vi.fn(async () => {
        calls.push("runtime");
        return { wasmUrl: "/assets/wllama.wasm" };
      }),
      fetchAsset: vi.fn(async () => {
        calls.push("wasm");
        return { ok: true };
      }),
    });

    await expect(primeOfflineRuntime(deps)).resolves.toEqual({
      ok: true,
      wasmUrl: "/assets/wllama.wasm",
    });
    expect(calls).toEqual(["controlled", "runtime", "wasm"]);
  });

  it("does not request runtime files when the device is already offline", async () => {
    const deps = dependencies({ online: false });
    await expect(primeOfflineRuntime(deps)).resolves.toEqual({ ok: false, reason: "offline" });
    expect(deps.loadRuntime).not.toHaveBeenCalled();
    expect(deps.fetchAsset).not.toHaveBeenCalled();
  });

  it("does not create an uncached request when the worker is not controlling the page", async () => {
    const deps = dependencies({ waitForController: vi.fn().mockResolvedValue(false) });
    await expect(primeOfflineRuntime(deps)).resolves.toEqual({
      ok: false,
      reason: "not_controlled",
    });
    expect(deps.loadRuntime).not.toHaveBeenCalled();
  });

  it("fails softly when the runtime asset cannot be fetched", async () => {
    const deps = dependencies({ fetchAsset: vi.fn().mockResolvedValue({ ok: false }) });
    await expect(primeOfflineRuntime(deps)).resolves.toEqual({
      ok: false,
      reason: "load_failed",
    });
  });
});
