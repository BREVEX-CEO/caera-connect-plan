import {
  unavailable,
  type AdapterAvailability,
  type BrainAdapter,
  type BrainMessage,
  type BrainStreamHandlers,
  type BrainStreamResult,
} from "../adapter";
import { chooseBrowserTier, formatSize, type BrowserModelTier } from "../browser-catalogue";
import { loadBenchmark, recordBenchmark } from "../tier-benchmark-store";

/**
 * OCADE in the browser, on the graphics card, via WebLLM.
 *
 * FOUR THINGS THIS ADAPTER REFUSES TO DO
 *
 * 1. **Load anything during `probe()`.** Probing happens on every routing
 *    decision. If it downloaded weights, opening the chat screen would pull
 *    hundreds of megabytes before the user typed a character.
 * 2. **Run on the UI thread.** Everything goes through a worker; see
 *    `webllm.worker.ts` for why that is not optional.
 * 3. **Import WebLLM unless it is actually used.** The library is large. A
 *    static import would put it in the main bundle for every user, including
 *    the majority who route to a desktop engine and never touch it.
 * 4. **Promote on optimism.** Every device starts on the SMALLEST model. The
 *    adapter's reported limit can only rule a tier OUT; moving up requires a
 *    recorded benchmark from a real generation on this device. Browsers report
 *    a flat 2 GB `maxBufferSize` almost everywhere, so treating it as capacity
 *    promoted nearly everyone — including an integrated Intel Iris Xe — which
 *    is the optimism that makes a laptop unusable.
 */

type WebLlmModule = typeof import("@mlc-ai/web-llm");
type WebLlmEngine = Awaited<ReturnType<WebLlmModule["CreateWebWorkerMLCEngine"]>>;

export interface WebGpuProgress {
  /** 0–1 while weights are being fetched, or null before a total is known. */
  fraction: number | null;
  text: string;
}

export class BrowserWebGpuAdapter implements BrainAdapter {
  readonly id = "browser_webgpu" as const;
  readonly displayName = "OCADE Browser";

  private engine: WebLlmEngine | null = null;
  private worker: Worker | null = null;
  private loadedModelId: string | null = null;
  private cachedTier: BrowserModelTier | null = null;
  private readonly onProgress?: (p: WebGpuProgress) => void;

  constructor(options?: { onProgress?: (p: WebGpuProgress) => void }) {
    this.onProgress = options?.onProgress;
  }

  /**
   * The largest single allocation this adapter permits.
   *
   * NOT a VRAM measurement, and not treated as one: it is passed to the
   * catalogue as a ceiling that can only exclude tiers.
   */
  private static async gpuMemoryBudget(): Promise<
    { ok: true; bytes: number | null } | { ok: false; reason: string }
  > {
    const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
    if (!gpu) {
      return {
        ok: false,
        reason: "This browser cannot use the graphics card for OCADE (no WebGPU).",
      };
    }
    let adapter: GPUAdapter | null;
    try {
      adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    } catch (error) {
      return {
        ok: false,
        reason: `The graphics card could not be prepared: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
    if (!adapter) {
      return { ok: false, reason: "The graphics card did not offer OCADE an adapter." };
    }
    const maxBuffer = adapter.limits?.maxBufferSize;
    return { ok: true, bytes: typeof maxBuffer === "number" ? Number(maxBuffer) : null };
  }

  async probe(): Promise<AdapterAvailability> {
    if (typeof window === "undefined") {
      return unavailable("unsupported_device", "There is no browser here to run OCADE in.");
    }

    const budget = await BrowserWebGpuAdapter.gpuMemoryBudget();
    if (!budget.ok) {
      // Falls through to the WebAssembly adapter, which is why this is a plain
      // unavailability rather than a refusal with remedies.
      return unavailable("unsupported_device", budget.reason);
    }

    /*
     * `budget.bytes` is a CEILING, not a capacity: browsers report a flat 2 GB
     * `maxBufferSize` on almost every device. It can exclude a tier; only a
     * recorded benchmark can promote to one.
     */
    const { tier } = chooseBrowserTier("webgpu", budget.bytes, loadBenchmark("webgpu"));
    if (budget.bytes !== null && tier.requiredMemoryBytes > budget.bytes) {
      return unavailable(
        "insufficient_memory",
        `OCADE's smallest browser engine needs about ${formatSize(
          tier.requiredMemoryBytes,
        )} of graphics memory and this device offers ${formatSize(budget.bytes)}.`,
      );
    }

    this.cachedTier = tier;
    return {
      available: true,
      label: tier.label,
      locality: "on_device",
      modelId: tier.webllmId ?? null,
      capabilities: {
        text: true,
        // No browser-tier vision model is offered yet, and claiming otherwise
        // would send images to a text-only model.
        vision: false,
        imageGeneration: false,
        tools: false,
      },
    };
  }

  /** Everything the user should be told before any bytes are fetched. */
  plan(): { tier: BrowserModelTier; downloadLabel: string } | null {
    if (!this.cachedTier) return null;
    return {
      tier: this.cachedTier,
      downloadLabel: formatSize(this.cachedTier.downloadBytes),
    };
  }

  private async ensureEngine(tier: BrowserModelTier): Promise<WebLlmEngine> {
    if (this.engine && this.loadedModelId === tier.webllmId) return this.engine;

    // Swapping tiers must not leave the previous model resident.
    if (this.engine) await this.dispose();

    const webllm: WebLlmModule = await import("@mlc-ai/web-llm");

    const known = webllm.prebuiltAppConfig.model_list.some((m) => m.model_id === tier.webllmId);
    if (!known) {
      throw new Error(
        `OCADE's browser engine "${tier.label}" is not available in this build of the runtime.`,
      );
    }

    this.worker = new Worker(new URL("./webllm.worker.ts", import.meta.url), { type: "module" });
    this.engine = await webllm.CreateWebWorkerMLCEngine(this.worker, tier.webllmId!, {
      initProgressCallback: (report) => {
        this.onProgress?.({
          fraction: typeof report.progress === "number" ? report.progress : null,
          text: report.text,
        });
      },
    });
    this.loadedModelId = tier.webllmId ?? null;
    return this.engine;
  }

  async stream(
    messages: BrainMessage[],
    handlers: BrainStreamHandlers,
  ): Promise<BrainStreamResult> {
    if (messages.some((m) => (m.images?.length ?? 0) > 0)) {
      return {
        ok: false,
        failure: "unavailable",
        reason: "OCADE's browser engine cannot read images. Attach it to a device engine instead.",
      };
    }

    const availability = await this.probe();
    if (!availability.available) {
      return { ok: false, failure: "unavailable", reason: availability.reason };
    }
    const tier = this.cachedTier;
    if (!tier) {
      return { ok: false, failure: "unavailable", reason: "No browser engine was selected." };
    }

    let engine: WebLlmEngine;
    try {
      engine = await this.ensureEngine(tier);
    } catch (error) {
      return {
        ok: false,
        failure: "error",
        reason: `OCADE's browser engine could not start: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    const startedAt = Date.now();
    let firstTokenMs: number | null = null;

    /*
     * Cancellation goes through the engine's own interrupt, not merely by
     * ignoring the rest of the stream. Abandoning the iterator would leave the
     * GPU generating tokens nobody reads — the fan keeps spinning and the
     * battery keeps draining after the user pressed stop.
     */
    const onAbort = () => {
      void engine.interruptGenerate();
    };
    handlers.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const completion = await engine.chat.completions.create({
        stream: true,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      for await (const chunk of completion) {
        if (handlers.signal?.aborted) break;
        const piece = chunk.choices[0]?.delta?.content;
        if (piece) {
          if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
          handlers.onToken(piece);
        }
      }

      if (handlers.signal?.aborted) {
        return { ok: false, failure: "cancelled", reason: "Stopped." };
      }
      if (firstTokenMs !== null) recordBenchmark("webgpu", tier.rank, firstTokenMs);
      return { ok: true, modelId: tier.webllmId ?? null, firstTokenMs };
    } catch (error) {
      if (handlers.signal?.aborted) {
        return { ok: false, failure: "cancelled", reason: "Stopped." };
      }
      return {
        ok: false,
        failure: "error",
        reason: `OCADE's browser engine stopped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    } finally {
      handlers.signal?.removeEventListener("abort", onAbort);
    }
  }

  async dispose(): Promise<void> {
    try {
      await this.engine?.unload();
    } catch {
      // Unloading a already-dead engine must not throw on the way out.
    }
    this.worker?.terminate();
    this.engine = null;
    this.worker = null;
    this.loadedModelId = null;
  }
}
