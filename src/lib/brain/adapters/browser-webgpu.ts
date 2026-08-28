import {
  unavailable,
  type AdapterAvailability,
  type BrainAdapter,
  type BrainMessage,
  type BrainStreamHandlers,
  type BrainStreamResult,
} from "../adapter";
import {
  chooseBrowserTier,
  formatSize,
  runtimeMemoryBytes,
  webgpuMirrorFileUrl,
  webgpuMirrorWeightsUrl,
  type BrowserModelTier,
} from "../browser-catalogue";
import { preferredWeightsUrl } from "../model-download";
import { loadBenchmark, recordBenchmark, recordTierFailure } from "../tier-benchmark-store";

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
  private readonly contextTokensOverride?: number;

  constructor(options?: {
    onProgress?: (p: WebGpuProgress) => void;
    /**
     * Run this tier with a smaller context than the catalogue declares.
     *
     * THE REDUCED RUNG OF THE CAPABILITY LADDER, and a real one rather than a
     * relabelled retry. The KV cache is the part of the working set that scales
     * with context, so halving it is a genuinely smaller allocation - which is
     * what a device that could not start at the standard size needs.
     *
     * It exists because the alternative was worse: refusing a device outright
     * on one conservative `maxBufferSize` reading turns away machines that
     * would have run perfectly well at a smaller window. A shorter conversation
     * is a real cost, and it is the honest one to pay before saying no.
     */
    contextTokensOverride?: number;
  }) {
    this.onProgress = options?.onProgress;
    this.contextTokensOverride = options?.contextTokensOverride;
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
    if (budget.bytes !== null && runtimeMemoryBytes(tier) > budget.bytes) {
      return unavailable(
        "insufficient_memory",
        `OCADE's smallest browser engine needs about ${formatSize(
          runtimeMemoryBytes(tier),
        )} of graphics memory and this device offers ${formatSize(budget.bytes)}.`,
      );
    }

    this.cachedTier = tier;
    return {
      available: true,
      label: tier.label,
      locality: "on_device",
      modelId: tier.webllmId ?? null,
      thinkingSuitable: tier.thinkingSuitable,
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

    const record = webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === tier.webllmId)!;

    /*
     * ONE AUTHORITY DECIDES, AND THIS DEPLOYMENT DECIDES WHERE THE BYTES COME
     * FROM.
     *
     * This used to spread `prebuiltAppConfig` whole, which meant two things
     * the rest of OCADE had already decided were quietly overridden by the
     * library:
     *
     *   - the context window. `browser-catalogue` states `contextTokens` and
     *     `systemPromptBudgetFor` sizes the compiled system prompt against it,
     *     but nothing ever told the runtime. It happened to agree at 4,096, so
     *     the budget was right by coincidence; a library bump that changed the
     *     record would have silently truncated OCADE's own rules out of the
     *     window with every test still green.
     *
     *   - the hosts. The record fetches weights from the publisher and its
     *     compiled library from raw.githubusercontent.com. Both are probed for
     *     a mirrored copy first, so a deployment that serves its own files
     *     makes no third-party request on first run, and one that does not is
     *     unchanged.
     *
     * The list is narrowed to this tier as well. A model_list of ninety
     * entries is ninety ways for a future edit to load something the
     * catalogue never approved.
     */
    const mirroredWeights = await preferredWeightsUrl(
      webgpuMirrorWeightsUrl(tier) ? `${webgpuMirrorWeightsUrl(tier)}/mlc-chat-config.json` : null,
      record.model,
    );
    const mirroredLib = await preferredWeightsUrl(
      webgpuMirrorFileUrl(tier, record.model_lib),
      record.model_lib,
    );

    this.worker = new Worker(new URL("./webllm.worker.ts", import.meta.url), { type: "module" });
    this.engine = await webllm.CreateWebWorkerMLCEngine(this.worker, tier.webllmId!, {
      /*
       * WEIGHTS GO TO INDEXEDDB, NOT THE CACHE API.
       *
       * web-llm defaults to the Cache API, which works and is what this adapter
       * used to get: driving the real page produced `webllm/model`,
       * `webllm/wasm` and `webllm/config` cache buckets while
       * `indexedDB.databases()` stayed empty.
       *
       * IndexedDB is the better home for this payload on the surfaces that
       * matter here. The Cache API is scoped to what a Service Worker is meant
       * to manage, and a registration change or a cache-cleanup sweep can take
       * roughly a gigabyte of model weights with it -- on mobile, where these
       * browser tiers actually get used, that is a silent re-download over
       * somebody's data plan. IndexedDB is ordinary application storage: it is
       * covered by persistent-storage grants, it survives Service Worker
       * churn, and it is the store a Capacitor shell keeps across app updates.
       *
       * The weights are unchanged either way; this only decides which drawer
       * they live in.
       *
       * The option is `cacheBackend: "indexeddb"`. It is not `useIndexedDBCache`
       * -- that was the name in older web-llm and it is gone in 0.2.84, where an
       * unknown key would have been accepted silently by the spread and changed
       * nothing at all. `tsc` caught it; without types it would have shipped as
       * a setting that reads correctly and does nothing.
       */
      appConfig: {
        ...webllm.prebuiltAppConfig,
        cacheBackend: "indexeddb",
        model_list: [
          {
            ...record,
            model: mirroredWeights.local ? webgpuMirrorWeightsUrl(tier)! : record.model,
            model_lib: mirroredLib.url,
            vram_required_MB: tier.requiredMemoryBytes / (1024 * 1024),
            overrides: {
              ...record.overrides,
              context_window_size: this.contextTokensOverride ?? tier.contextTokens,
            },
          },
        ],
      },
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

  /**
   * Download and compile the model before anybody asks a question.
   *
   * WITHOUT THIS, THE WEB CLIENT DOWNLOADS 340 MB ON THE FIRST MESSAGE.
   * `warm()` in `use-brain` only ever preloaded the desktop bridge, so on the
   * web -- where this adapter is the ONLY engine -- nothing happened until the
   * user pressed send, and then they waited on a progress bar they had not
   * asked for, mid-sentence.
   *
   * Idempotent and fire-and-forget by contract: `ensure` returns the existing
   * engine when there is one, and every failure is swallowed. A warm-up that
   * surfaces an error is reporting a problem with a message the user has not
   * sent yet.
   *
   * The bytes land in IndexedDB — see `cacheBackend` in `ensureEngine` above,
   * and the note there explaining why not Cache Storage — so a second visit
   * compiles from disk and asks the network for nothing. This comment said
   * Cache Storage while the code twenty lines up said otherwise, which is
   * exactly the kind of disagreement that sends somebody looking in the wrong
   * drawer for a missing gigabyte.
   */
  async preload(): Promise<void> {
    try {
      const availability = await this.probe();
      if (!availability.available) return;
      const chosen = this.plan();
      if (!chosen) return;
      await this.ensureEngine(chosen.tier);
    } catch {
      /* A browser that cannot warm up can still be told so when it is used. */
    }
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
        // Keep the runtime aligned with the sampling values recorded in the
        // answer receipt. Leaving these implicit made the receipt say 0.2/0.9
        // while WebLLM used its own defaults, and the 0.5B browser tier became
        // needlessly erratic on exact and arithmetic prompts.
        temperature: 0.2,
        top_p: 0.9,
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
      /*
       * A TIER THAT DIED HERE MUST NOT BE OFFERED AGAIN.
       *
       * Without this, a device fast enough at the smaller tier is promoted,
       * crashes or runs out of memory at the larger one, falls back, is fast
       * again, and is promoted straight back into the same crash — a silent
       * loop costing a large download each time round. Rank 0 is exempt
       * because there is nothing smaller to fall back to, and marking the only
       * available engine as failed would leave the device with none.
       */
      if (tier.rank > 0) recordTierFailure("webgpu", tier.rank);
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
