import { describe, expect, it, vi } from "vitest";

/**
 * A QUESTION ASKED WHILE THE ENGINE STARTS IS ANSWERED, NOT DROPPED.
 *
 * Opening OCADE checks the stored model and starts the offline engine from it, which takes
 * seconds. The real model in the cloud browser showed a question sent in those seconds
 * answered "OCADE is still preparing this device" and lost (13 Oct 2026).
 */
let finishLoading!: () => void;
let preparing: Promise<unknown> | null = null;

vi.mock("../installation-browser", () => ({
  installationAuthority: () => ({ pending: () => preparing, install: warm }),
}));

let stored: string | null = "v1";
const warm = vi.fn(async () => undefined);
vi.mock("../model-vault", () => ({
  modelVault: { load: async () => undefined, activeVersion: () => stored },
}));
vi.mock("../adapters/browser-wasm", () => ({
  BrowserWasmAdapter: class {
    async probe() {
      return { available: true, capabilities: { text: true, tools: false, vision: false } };
    }
    load() {
      return new Promise<void>((resolve) => {
        finishLoading = resolve;
      });
    }
    async stream() {
      return { ok: true as const, text: "blue" };
    }
  },
}));

describe("an engine still starting", () => {
  it("is waited for, and then answers", async () => {
    const { activateRuntimeForPath, authorityBackedAdapter, disposeRuntime } =
      await import("../runtime-activation");
    // Preparation under way: the stored model is checked first, then the engine starts.
    let release!: () => void;
    preparing = new Promise<void>((resolve) => (release = resolve)).then(() =>
      activateRuntimeForPath("wasm_single", "v1", () => {}),
    );
    const answer = authorityBackedAdapter().stream([], {} as never);
    release();
    await vi.waitFor(() => expect(finishLoading).toBeTypeOf("function"));
    finishLoading();
    await preparing;
    preparing = null;
    expect(await answer).toEqual({ ok: true, text: "blue" });
    await disposeRuntime();
  });

  it("starts the stored model when nothing is under way, and answers once it has", async () => {
    const { activateRuntimeForPath, authorityBackedAdapter, disposeRuntime } =
      await import("../runtime-activation");
    warm.mockImplementationOnce(async () => {
      finishLoading = undefined as never; // the engine this start loads, not the last one
      const activation = activateRuntimeForPath("wasm_single", "v1", () => {});
      await vi.waitFor(() => expect(finishLoading).toBeTypeOf("function"));
      finishLoading();
      await activation;
    });
    expect(await authorityBackedAdapter().probe()).toMatchObject({ available: true });
    expect(warm).toHaveBeenCalledWith({ reason: "warm" });
    await disposeRuntime();
  });

  it("never waits for, or starts, a model that is not on the device yet", async () => {
    stored = null;
    warm.mockClear();
    const { authorityBackedAdapter } = await import("../runtime-activation");
    const answer = await authorityBackedAdapter().stream([], {} as never);
    expect(answer).toMatchObject({ ok: false, reason: "OCADE is still preparing this device." });
    expect(warm).not.toHaveBeenCalled();
  });
});
