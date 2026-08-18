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
  ggufUrl,
  sameOriginGgufUrl,
  storageKeyFor,
  sha256For,
  type BrowserModelTier,
} from "../browser-catalogue";
import { modelStore, ModelStore } from "../model-store";
import { downloadModel, preferredWeightsUrl } from "../model-download";
import { loadBenchmark, recordBenchmark } from "../tier-benchmark-store";

type WllamaModule = typeof import("@wllama/wllama");
type WllamaInstance = InstanceType<WllamaModule["Wllama"]>;

export interface WasmProgress {
  fraction: number | null;
  text: string;
}

/** Browser CPU fallback. It runs only from OCADE's verified, resumable model store. */
export class BrowserWasmAdapter implements BrainAdapter {
  readonly id = "browser_wasm" as const;
  readonly displayName = "OCADE Browser (compatibility)";

  private instance: WllamaInstance | null = null;
  private loadedRepo: string | null = null;
  private cachedTier: BrowserModelTier | null = null;
  private starting: Promise<WllamaInstance> | null = null;
  private startingKey: string | null = null;
  private readonly onProgress?: (p: WasmProgress) => void;

  constructor(options?: { onProgress?: (p: WasmProgress) => void }) {
    this.onProgress = options?.onProgress;
  }

  async probe(): Promise<AdapterAvailability> {
    if (typeof window === "undefined") {
      return unavailable("unsupported_device", "There is no browser here to run OCADE in.");
    }
    if (typeof WebAssembly === "undefined") {
      return unavailable("unsupported_device", "This browser cannot run WebAssembly, so OCADE has no CPU fallback here.");
    }
    // Never fall through to wllama's opaque cache: that path cannot satisfy
    // OCADE's digest verification, resumable storage, or user-managed removal.
    if (!ModelStore.isSupported()) {
      return unavailable(
        "unsupported_device",
        "This browser cannot provide OCADE's verified persistent model store, so the compatibility engine will not download unverified weights.",
      );
    }

    const { tier } = chooseBrowserTier("wasm", null, loadBenchmark("wasm"));
    let quotaBytes: number | null = null;
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (estimate?.quota !== undefined) quotaBytes = Math.max(0, estimate.quota - (estimate.usage ?? 0));
    } catch {
      quotaBytes = null;
    }
    if (quotaBytes !== null && quotaBytes < tier.downloadBytes) {
      return unavailable(
        "insufficient_storage",
        `OCADE's compatibility engine needs about ${formatSize(tier.downloadBytes)} and this browser will only allow ${formatSize(quotaBytes)}.`,
        ["free_storage"],
      );
    }

    this.cachedTier = tier;
    return {
      available: true,
      label: tier.label,
      locality: "on_device",
      modelId: storageKeyFor(tier),
      capabilities: { text: true, vision: false, imageGeneration: false, tools: false },
    };
  }

  plan(): { tier: BrowserModelTier; downloadLabel: string; multiThreaded: boolean } | null {
    if (!this.cachedTier) return null;
    return {
      tier: this.cachedTier,
      downloadLabel: formatSize(this.cachedTier.downloadBytes),
      multiThreaded: typeof SharedArrayBuffer !== "undefined",
    };
  }

  /** Single-flight loading prevents preload + first-send from constructing twice. */
  private async ensureLoaded(tier: BrowserModelTier): Promise<WllamaInstance> {
    const key = storageKeyFor(tier);
    if (!key) throw new Error("This browser tier has no persistent storage key.");
    if (this.instance && this.loadedRepo === key) return this.instance;
    if (this.starting && this.startingKey === key) return this.starting;

    if (this.starting) {
      try {
        await this.starting;
      } catch {
        // The original caller observes the error; retry below from a clean state.
      }
      if (this.instance && this.loadedRepo === key) return this.instance;
    }
    if (this.instance) await this.dispose();

    const startPromise = (async () => {
      const wllama: WllamaModule = await import("@wllama/wllama");
      const singleThreadWasm = (await import("@wllama/wllama/esm/wasm/wllama.wasm?url")).default;
      const instance = new wllama.Wllama(
        { default: singleThreadWasm, "single-thread/wllama.wasm": singleThreadWasm },
        { allowOffline: true },
      );

      try {
        const url = ggufUrl(tier);
        if (!url) throw new Error("This browser tier has no model file configured.");
        const stored = await modelStore.readMeta(key);
        const size = await modelStore.sizeOf(key);
        const alreadyVerified =
          stored?.verified === true && stored.expectedBytes === size && size > 0;
        const source = alreadyVerified
          ? { url, local: false }
          : await preferredWeightsUrl(sameOriginGgufUrl(tier), url);

        const download = await downloadModel({
          key,
          url: source.url,
          expectedBytes: tier.downloadBytes,
          sha256: sha256For(tier),
          onProgress: (p) =>
            this.onProgress?.({ fraction: p.fraction, text: `Downloading ${tier.label}` }),
        });
        if (!download.ok) throw new Error(download.reason);
        if (!download.verified) {
          throw new Error("OCADE refuses to execute compatibility weights that were not fingerprint-verified.");
        }

        const blob = await modelStore.readBlob(key);
        if (!blob) throw new Error("The verified engine file could not be read back from local storage.");
        await instance.loadModel([blob]);
        this.instance = instance;
        this.loadedRepo = key;
        return instance;
      } catch (error) {
        try {
          await instance.exit();
        } catch {
          // Nothing else to clean up.
        }
        throw error;
      }
    })();

    this.starting = startPromise;
    this.startingKey = key;
    try {
      return await startPromise;
    } finally {
      if (this.starting === startPromise) {
        this.starting = null;
        this.startingKey = null;
      }
    }
  }

  async preload(): Promise<void> {
    try {
      const availability = await this.probe();
      if (!availability.available) return;
      const tier = this.cachedTier;
      if (!tier) return;
      await this.ensureLoaded(tier);
    } catch {
      // A speculative warm-up can be retried by the actual user request.
    }
  }

  async stream(messages: BrainMessage[], handlers: BrainStreamHandlers): Promise<BrainStreamResult> {
    if (messages.some((m) => (m.images?.length ?? 0) > 0)) {
      return {
        ok: false,
        failure: "unavailable",
        reason: "OCADE's compatibility engine cannot read images. A device engine or paired computer can.",
      };
    }

    const availability = await this.probe();
    if (!availability.available) return { ok: false, failure: "unavailable", reason: availability.reason };
    const tier = this.cachedTier;
    if (!tier) return { ok: false, failure: "unavailable", reason: "No browser engine was selected." };

    let instance: WllamaInstance;
    try {
      instance = await this.ensureLoaded(tier);
    } catch (error) {
      return {
        ok: false,
        failure: "error",
        reason: `OCADE's compatibility engine could not start: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const startedAt = Date.now();
    let firstTokenMs: number | null = null;
    try {
      const stream = await instance.createChatCompletion({
        stream: true,
        abortSignal: handlers.signal,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      for await (const chunk of stream) {
        if (handlers.signal?.aborted) break;
        const piece = chunk.choices?.[0]?.delta?.content;
        if (piece) {
          if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
          handlers.onToken(piece);
        }
      }
      if (handlers.signal?.aborted) return { ok: false, failure: "cancelled", reason: "Stopped." };
      if (firstTokenMs !== null) recordBenchmark("wasm", tier.rank, firstTokenMs);
      return { ok: true, modelId: this.loadedRepo, firstTokenMs };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (handlers.signal?.aborted || name === "WllamaAbortError" || name === "AbortError") {
        return { ok: false, failure: "cancelled", reason: "Stopped." };
      }
      return {
        ok: false,
        failure: "error",
        reason: `OCADE's compatibility engine stopped: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async dispose(): Promise<void> {
    const starting = this.starting;
    if (starting) {
      try {
        await starting;
      } catch {
        // Startup already cleaned up its temporary instance.
      }
    }
    try {
      await this.instance?.exit();
    } catch {
      // Tearing down an engine that already died must not throw.
    }
    this.instance = null;
    this.loadedRepo = null;
    this.starting = null;
    this.startingKey = null;
  }
}
