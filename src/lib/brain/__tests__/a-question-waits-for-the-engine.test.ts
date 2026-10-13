import { describe, expect, it, vi } from "vitest";

/**
 * A QUESTION ASKED WHILE THE ENGINE STARTS IS ANSWERED, NOT DROPPED.
 *
 * Opening OCADE starts the offline engine from the stored model, which takes seconds. The
 * real model in the cloud browser showed a question sent in those seconds answered "OCADE is
 * still preparing this device" and lost (13 Oct 2026).
 */
let finishLoading!: () => void;

vi.mock("../model-vault", () => ({ modelVault: {} }));
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
    const activation = activateRuntimeForPath("wasm_single", "v1", () => {});
    const answer = authorityBackedAdapter().stream([], {} as never);
    await vi.waitFor(() => expect(finishLoading).toBeTypeOf("function"));
    finishLoading();
    await activation;
    expect(await answer).toEqual({ ok: true, text: "blue" });
    await disposeRuntime();
  });

  it("still says it is preparing when nothing is starting", async () => {
    const { authorityBackedAdapter } = await import("../runtime-activation");
    const answer = await authorityBackedAdapter().stream([], {} as never);
    expect(answer).toMatchObject({ ok: false, reason: "OCADE is still preparing this device." });
  });
});
