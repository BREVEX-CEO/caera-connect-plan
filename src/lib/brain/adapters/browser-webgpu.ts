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

type WebLlmModule = typeof import("@mlc-ai/web-llm");
type WebLlmEngine = Awaited<ReturnType<WebLlmModule["CreateWebWorkerMLCEngine"]>>;

export interface WebGpuProgress {
  fraction: number | null;
  text: string;
}

/** Browser-local WebGPU engine. Model shards are persisted by WebLLM in IndexedDB. */
export class BrowserWebGpuAdapter implements BrainAdapter {
  readonly id = "browser_webgpu" as const;
  readonly displayName = "OCADE Browser";

  private engine: WebLlmEngine | null = null;
  private worker: Worker | null = null;
  private loadedModelId: string | null = null;
  private cachedTier: BrowserModelTier | null = null;
  private starting: Promise<WebLlmEngine> | null = null;
  private startingModelId: string | null = null;
  private readonly onProgress?: (p: WebGpuProgress) => void;

  constructor(options?: { onProgress?: (p: WebGpuProgress) => void }) {
    this.onProgress = options?.onProgress;
  }

  /** maxBufferSize is a ceiling only; it is NOT treated as measured VRAM. */
  private static async gpuMemoryBudget(): Promise<
    { ok: true; bytes: number | null } | { ok: false; reason: string }
  > {
    const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
    if (!gpu) return { ok: false, reason: "This browser cannot use the graphics card for OCADE (no WebGPU)." };
    let adapter: GPUAdapter | null;
    try {
      adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    } catch (error) {
      return {
        ok: false,
        reason: `The graphics card could not be prepared: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    if (!adapter) return { ok: false, reason: "The graphics card did not offer OCADE an adapter." };
    const maxBuffer = adapter.limits?.maxBufferSize;
    return { ok: true, bytes: typeof maxBuffer === "number" ? Number(maxBuffer) : null };
  }

  async probe(): Promise<AdapterAvailability> {
    if (typeof window === "undefined") {
      return unavailable("unsupported_device", "There is no browser here to run OCADE in.");
    }
    const budget = await BrowserWebGpuAdapter.gpuMemoryBudget();
    if (!budget.ok) return unavailable("unsupported_device", budget.reason);

    const { tier } = chooseBrowserTier("webgpu", budget.bytes, loadBenchmark("webgpu"));
    if (budget.bytes !== null && tier.requiredMemoryBytes > budget.bytes) {
      return unavailable(
        "insufficient_memory",
        `OCADE's smallest browser engine needs about ${formatSize(tier.requiredMemoryBytes)} of graphics memory and this device offers ${formatSize(budget.bytes)}.`,
      );
    }
    this.cachedTier = tier;
    return {
      available: true,
      label: tier.label,
      locality: "on_device",
      modelId: tier.webllmId ?? null,
      capabilities: { text: true, vision: false, imageGeneration: false, tools: false },
    };
  }

  plan(): { tier: BrowserModelTier; downloadLabel: string } | null {
    if (!this.cachedTier) return null;
    return { tier: this.cachedTier, downloadLabel: formatSize(this.cachedTier.downloadBytes) };
  }

  /**
   * Single-flight engine initialization.
   *
   * `preload()` and the first `stream()` can race during page startup. Earlier
   * code observed `engine === null` in both calls and created two workers/model
   * loads. All callers for the same tier now await one construction promise.
   */
  private async ensureEngine(tier: BrowserModelTier): Promise<WebLlmEngine> {
    const modelId = tier.webllmId;
    if (!modelId) throw new Error("This WebGPU tier has no runtime model id.");
    if (this.engine && this.loadedModelId === modelId) return this.engine;
    if (this.starting && this.startingModelId === modelId) return this.starting;

    // If another tier is currently starting, let it settle before swapping.
    if (this.starting) {
      try {
        await this.starting;
      } catch {
        // Its caller receives the original error; this caller can retry cleanly.
      }
      if (this.engine && this.loadedModelId === modelId) return this.engine;
    }
    if (this.engine) await this.dispose();

    const startPromise = (async () => {
      const webllm: WebLlmModule = await import("@mlc-ai/web-llm");
      const known = webllm.prebuiltAppConfig.model_list.some((m) => m.model_id === modelId);
      if (!known) {
        throw new Error(`OCADE's browser engine "${tier.label}" is not available in this runtime build.`);
      }

      const worker = new Worker(new URL("./webllm.worker.ts", import.meta.url), { type: "module" });
      try {
        const engine = await webllm.CreateWebWorkerMLCEngine(worker, modelId, {
          // Model shards are app storage, not download-manager files.
          appConfig: { ...webllm.prebuiltAppConfig, cacheBackend: "indexeddb" },
          initProgressCallback: (report) => {
            this.onProgress?.({
              fraction: typeof report.progress === "number" ? report.progress : null,
              text: report.text,
            });
          },
        });
        this.worker = worker;
        this.engine = engine;
        this.loadedModelId = modelId;
        return engine;
      } catch (error) {
        worker.terminate();
        throw error;
      }
    })();

    this.starting = startPromise;
    this.startingModelId = modelId;
    try {
      return await startPromise;
    } finally {
      if (this.starting === startPromise) {
        this.starting = null;
        this.startingModelId = null;
      }
    }
  }

  async preload(): Promise<void> {
    try {
      const availability = await this.probe();
      if (!availability.available) return;
      const chosen = this.plan();
      if (!chosen) return;
      await this.ensureEngine(chosen.tier);
    } catch {
      // A failed speculative warmup is surfaced only if the user actually uses it.
    }
  }

  async stream(messages: BrainMessage[], handlers: BrainStreamHandlers): Promise<BrainStreamResult> {
    if (messages.some((m) => (m.images?.length ?? 0) > 0)) {
      return {
        ok: false,
        failure: "unavailable",
        reason: "OCADE's browser engine cannot read images. Attach it to a device engine instead.",
      };
    }

    const availability = await this.probe();
    if (!availability.available) return { ok: false, failure: "unavailable", reason: availability.reason };
    const tier = this.cachedTier;
    if (!tier) return { ok: false, failure: "unavailable", reason: "No browser engine was selected." };

    let engine: WebLlmEngine;
    try {
      engine = await this.ensureEngine(tier);
    } catch (error) {
      return {
        ok: false,
        failure: "error",
        reason: `OCADE's browser engine could not start: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const startedAt = Date.now();
    let firstTokenMs: number | null = null;
    const onAbort = () => void engine.interruptGenerate();
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
      if (handlers.signal?.aborted) return { ok: false, failure: "cancelled", reason: "Stopped." };
      if (firstTokenMs !== null) recordBenchmark("webgpu", tier.rank, firstTokenMs);
      return { ok: true, modelId: tier.webllmId ?? null, firstTokenMs };
    } catch (error) {
      if (handlers.signal?.aborted) return { ok: false, failure: "cancelled", reason: "Stopped." };
      return {
        ok: false,
        failure: "error",
        reason: `OCADE's browser engine stopped: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      handlers.signal?.removeEventListener("abort", onAbort);
    }
  }

  async dispose(): Promise<void> {
    const starting = this.starting;
    if (starting) {
      try {
        await starting;
      } catch {
        // Failed startup already terminated its temporary worker.
      }
    }
    try {
      await this.engine?.unload();
    } catch {
      // Unloading an already-dead engine must not throw during cleanup.
    }
    this.worker?.terminate();
    this.engine = null;
    this.worker = null;
    this.loadedModelId = null;
    this.starting = null;
    this.startingModelId = null;
  }
}
