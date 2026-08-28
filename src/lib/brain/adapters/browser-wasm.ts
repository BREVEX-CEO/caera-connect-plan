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
  resolvedFor,
  type BrowserModelTier,
} from "../browser-catalogue";
import { modelStore, ModelStore } from "../model-store";
import { downloadModel, preferredWeightsUrl } from "../model-download";
import { loadBenchmark, recordBenchmark, recordTierFailure } from "../tier-benchmark-store";

/**
 * OCADE in the browser on the processor, via wllama (llama.cpp compiled to
 * WebAssembly).
 *
 * THIS IS THE FALLBACK, AND IT KNOWS IT. It exists so a browser without WebGPU
 * still gets a working OCADE rather than a refusal. It is materially slower,
 * its capability label says "compatibility", and only the smallest model is
 * offered — a larger one here produces a first token slowly enough that people
 * assume the page has hung.
 *
 * ON THREADS, AND A TRADE-OFF WORTH STATING
 *
 * wllama runs much faster multi-threaded, which needs `SharedArrayBuffer`,
 * which needs cross-origin isolation (COOP `same-origin` + COEP). OCADE does
 * NOT enable that, because COOP `same-origin` severs `window.opener` and would
 * break the Google and Apple sign-in popups this product depends on. Sign-in
 * that works beats a fallback engine that is twice as fast, so this runs
 * single-threaded and says so. `wllama` selects that automatically when
 * `SharedArrayBuffer` is absent.
 */

type WllamaModule = typeof import("@wllama/wllama");
type WllamaInstance = InstanceType<WllamaModule["Wllama"]>;

export interface WasmProgress {
  fraction: number | null;
  text: string;
}

/**
 * Where a deployment may put the multi-threaded engine binary.
 *
 * Same idea as `public/models/` for weights: an operator drops the file in and
 * the product uses it, with no external request either way. Probed rather than
 * assumed, so a deployment that has not vendored it is simply single-threaded
 * instead of broken.
 */
export const MULTI_THREAD_WASM_PATH = "/wasm/multi-thread/wllama.wasm";

/** Cached, because a HEAD per engine load would be a request on every start. */
let multiThreadProbe: Promise<string | null> | null = null;

export function resetMultiThreadProbeForTests(): void {
  multiThreadProbe = null;
}

/**
 * Is a self-hosted multi-threaded build present AND usable?
 *
 * Both halves matter. Isolation without the binary means threads that cannot
 * run; the binary without isolation means a build that cannot use
 * `SharedArrayBuffer`. Only the pair is a threaded engine, and anything else
 * falls back to the single-threaded one, which always works.
 */
export async function selfHostedMultiThreadWasm(): Promise<string | null> {
  if (typeof SharedArrayBuffer !== "function" || globalThis.crossOriginIsolated !== true) {
    return null;
  }
  if (typeof fetch !== "function") return null;
  multiThreadProbe ??= (async () => {
    try {
      const probe = await fetch(MULTI_THREAD_WASM_PATH, { method: "HEAD" });
      // A 404 is the normal answer on a deployment that has not vendored it,
      // and an SSR fallback can answer 200 with HTML, which is not a binary.
      const type = probe.headers.get("content-type") ?? "";
      if (probe.ok && !type.includes("text/html")) return MULTI_THREAD_WASM_PATH;
    } catch {
      /* Not self-hosted, or unreachable. Single-threaded it is. */
    }
    return null;
  })();
  return multiThreadProbe;
}

export class BrowserWasmAdapter implements BrainAdapter {
  readonly id = "browser_wasm" as const;
  readonly displayName = "OCADE Browser (compatibility)";

  private instance: WllamaInstance | null = null;
  private loadedRepo: string | null = null;
  private cachedTier: BrowserModelTier | null = null;
  private readonly onProgress?: (p: WasmProgress) => void;
  private readonly weightsProvider?: () => Promise<Blob | null>;
  private readonly preferThreads: boolean;

  constructor(options?: {
    onProgress?: (p: WasmProgress) => void;
    /**
     * Hand the adapter its weights instead of letting it fetch them.
     *
     * THIS IS WHAT STOPS A SECOND DOWNLOAD EXISTING. When the installation
     * authority is driving, it has already fetched, digest-checked and
     * activated the artifact, and it passes the bytes in. The adapter then has
     * no code path that can start a transfer of its own — which is the defect
     * that let a keystroke, a send, and two other tabs each begin fetching the
     * same gigabyte.
     *
     * The self-contained path below remains for callers that genuinely have no
     * authority — the evidence harness and the offline-install scripts — and it
     * is held to exactly the same digest.
     */
    weightsProvider?: () => Promise<Blob | null>;
    /** Use the multi-threaded build when the page is cross-origin isolated. */
    preferThreads?: boolean;
  }) {
    this.onProgress = options?.onProgress;
    this.weightsProvider = options?.weightsProvider;
    this.preferThreads = options?.preferThreads ?? false;
  }

  async probe(): Promise<AdapterAvailability> {
    if (typeof window === "undefined") {
      return unavailable("unsupported_device", "There is no browser here to run OCADE in.");
    }
    if (typeof WebAssembly === "undefined") {
      return unavailable(
        "unsupported_device",
        "This browser cannot run WebAssembly, so OCADE has no engine it can use here.",
      );
    }

    /*
     * Storage, not memory, is the binding constraint for this engine: the
     * weights are cached so a reload does not re-download them. A browser that
     * refuses to say how much room it has is not treated as full — it is
     * treated as unknown, and the smallest tier is used.
     */
    const { tier } = chooseBrowserTier("wasm", null, loadBenchmark("wasm"));
    let quotaBytes: number | null = null;
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (estimate?.quota !== undefined) {
        quotaBytes = Math.max(0, estimate.quota - (estimate.usage ?? 0));
      }
    } catch {
      quotaBytes = null;
    }
    if (quotaBytes !== null && quotaBytes < tier.downloadBytes) {
      return unavailable(
        "insufficient_storage",
        `OCADE's compatibility engine needs about ${formatSize(
          tier.downloadBytes,
        )} and this browser will only allow ${formatSize(quotaBytes)}.`,
        ["free_storage"],
      );
    }

    this.cachedTier = tier;
    return {
      available: true,
      label: tier.label,
      locality: "on_device",
      modelId: storageKeyFor(tier),
      thinkingSuitable: tier.thinkingSuitable,
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

  /**
   * Download and load the model before anybody asks a question.
   *
   * THE FALLBACK NEEDS THIS MORE THAN THE PRIMARY DID. `use-brain` warmed only
   * the WebGPU adapter, so a browser with no usable GPU adapter -- which is
   * exactly the machine this adapter exists for -- prepared nothing at all,
   * and its download started on the user's first message. A fallback that is
   * not made ready like the primary is a fallback that is always cold.
   *
   * Idempotent and fire-and-forget by contract, matching the WebGPU adapter:
   * `ensureLoaded` returns the existing instance when there is one, and every
   * failure is swallowed. A warm-up that surfaces an error is reporting a
   * problem with a message the user has not sent yet.
   */
  async preload(): Promise<void> {
    try {
      const availability = await this.probe();
      if (!availability.available) return;
      const chosen = this.plan();
      if (!chosen) return;
      await this.ensureLoaded(chosen.tier);
    } catch {
      /* A browser that cannot warm up can still be told so when it is used. */
    }
  }

  /**
   * Load now, and REPORT A FAILURE rather than swallowing it.
   *
   * The difference from `preload` is who is asking. `preload` is a speculative
   * warm-up whose failure must never surface — it is a problem with a message
   * the user has not sent. This is the installation authority asking "does this
   * rung work on this device", and there the answer matters: a swallowed error
   * would look like success and stop the ladder from falling through to the
   * next rung.
   */
  async load(): Promise<void> {
    const availability = await this.probe();
    if (!availability.available) throw new Error(availability.reason);
    const chosen = this.plan();
    if (!chosen) throw new Error("No processor engine was selected for this device.");
    await this.ensureLoaded(chosen.tier);
  }

  private async ensureLoaded(tier: BrowserModelTier): Promise<WllamaInstance> {
    const key = storageKeyFor(tier);
    if (this.instance && this.loadedRepo === key) return this.instance;
    if (this.instance) await this.dispose();

    const wllama: WllamaModule = await import("@wllama/wllama");

    /*
     * The WebAssembly binary is served from OCADE's own origin rather than a
     * CDN. A local-first product that silently fetches its engine from a third
     * party every time it starts is not local-first, and an offline user would
     * find the fallback broken exactly when they needed it.
     */
    const singleThreadWasm = (await import("@wllama/wllama/esm/wasm/wllama.wasm?url")).default;

    /*
     * THE MULTI-THREADED BUILD, WHEN THE PLATFORM ACTUALLY ALLOWS IT.
     *
     * wllama runs materially faster across several cores, which needs
     * `SharedArrayBuffer`, which needs cross-origin isolation. The note that
     * used to sit here said isolation was avoided because COOP `same-origin`
     * severs `window.opener` and would break the sign-in popups — and that is
     * no longer what this application does: `auth.tsx` signs in through a
     * full-page redirect to `/auth/callback`, which COOP does not touch.
     *
     * What remains true is that isolation also requires COEP, and that is a
     * deployment-wide constraint on every cross-origin subresource. So this
     * does not turn isolation on; it USES it the moment the platform reports it
     * is in force — in an installed app shell, a Capacitor build, or a
     * deployment that has set the headers and proven them. `crossOriginIsolated`
     * is the only honest test, because `SharedArrayBuffer` can exist and still
     * be unusable by the threaded build without it.
     *
     * The single-threaded path is always underneath, so nothing here can leave
     * a device without an engine.
     */
    const builds: {
      default: string;
      "single-thread/wllama.wasm": string;
      "multi-thread/wllama.wasm"?: string;
    } = {
      default: singleThreadWasm,
      "single-thread/wllama.wasm": singleThreadWasm,
    };

    /*
     * WHAT SHIPS IN THE PACKAGE, AND WHAT DOES NOT.
     *
     * `@wllama/wllama@3.5.1` installs exactly one binary — `wllama.wasm`,
     * the single-threaded build. Its `AssetsPathConfig` accepts a
     * `multi-thread/wllama.wasm`, but that file is NOT in the package; the
     * library's own multi-thread path expects it from a CDN, which a
     * local-first product will not fetch its engine from.
     *
     * So the threaded engine is offered only when a deployment SELF-HOSTS the
     * binary, exactly as `public/models/` works for weights. That keeps the
     * claim honest in both directions: a deployment that has vendored the build
     * gets real threads, and one that has not is never told it has them.
     * `crossOriginIsolated` is checked as well, because without isolation the
     * threaded build cannot use `SharedArrayBuffer` no matter where it came
     * from.
     */
    const multiThreadUrl = this.preferThreads ? await selfHostedMultiThreadWasm() : null;
    if (multiThreadUrl) builds["multi-thread/wllama.wasm"] = multiThreadUrl;

    const instance = new wllama.Wllama(builds, { allowOffline: true });

    /*
     * Weights come from OCADE'S OWN STORE, not the library's internal cache.
     *
     * That is what makes pause, resume, digest verification, repair and
     * removal possible at all: wllama's cache is opaque, so a user could not
     * be told how much space the engine uses, could not resume an interrupted
     * transfer, and could not delete it from a settings page. Storage the
     * product cannot see is storage the product cannot be honest about.
     */
    const url = ggufUrl(tier);
    if (!key || !url) {
      throw new Error("This browser tier has no model file configured.");
    }

    /*
     * THE AUTHORITY'S BYTES WIN, AND NOTHING ELSE RUNS.
     *
     * When a provider is supplied the artifact has already been fetched,
     * digest-checked and activated by the installation authority, so this
     * returns without touching the network at all. That is not an optimisation:
     * it is the property that makes "one canonical installation" true. Every
     * path below is only reachable when there is no authority driving.
     */
    if (this.weightsProvider) {
      const blob = await this.weightsProvider();
      if (!blob) {
        throw new Error("OCADE's prepared engine could not be read back from this device.");
      }
      await instance.loadModel([blob]);
      this.instance = instance;
      this.loadedRepo = key;
      return instance;
    }

    if (ModelStore.isSupported()) {
      /*
       * Weights this deployment serves itself win over the publisher's host,
       * so an air-gapped or egress-restricted install can reach a working
       * engine on first run without an external request. A deployment that
       * does not self-host is unaffected — the probe 404s and `url` is used.
       *
       * SKIPPED ENTIRELY once the engine is on disk and verified. `downloadModel`
       * would return from storage without fetching anything, so probing first
       * would put a request on every single engine load — on the offline path,
       * where the whole point is that nothing is requested at all.
       */
      const stored = await modelStore.readMeta(key);
      const alreadyVerified = stored?.verified === true && (await modelStore.sizeOf(key)) > 0;
      const source = alreadyVerified
        ? { url, local: false }
        : await preferredWeightsUrl(sameOriginGgufUrl(tier), url);
      const download = await downloadModel({
        key,
        url: source.url,
        expectedBytes: tier.downloadBytes,
        sha256: sha256For(tier),
        onProgress: (p) =>
          this.onProgress?.({
            fraction: p.fraction,
            text: `Downloading ${tier.label}`,
          }),
      });
      if (!download.ok) throw new Error(download.reason);

      const blob = await modelStore.readBlob(key);
      if (!blob) throw new Error("The engine was downloaded but could not be read back.");
      await instance.loadModel([blob]);
    } else {
      // No OPFS: fall back to the library's own fetch so the engine still
      // works, accepting that it cannot be managed from Settings.
      const entry = resolvedFor(tier);
      if (!entry) throw new Error("This browser tier has no model file configured.");
      await instance.loadModelFromHF(
        { repo: entry.repo, file: entry.path },
        {
          useCache: true,
          progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
            this.onProgress?.({
              fraction: total > 0 ? loaded / total : null,
              text: `Downloading ${tier.label}`,
            });
          },
        },
      );
    }

    this.instance = instance;
    this.loadedRepo = key;
    return instance;
  }

  async stream(
    messages: BrainMessage[],
    handlers: BrainStreamHandlers,
  ): Promise<BrainStreamResult> {
    if (messages.some((m) => (m.images?.length ?? 0) > 0)) {
      return {
        ok: false,
        failure: "unavailable",
        reason:
          "OCADE's compatibility engine cannot read images. A device engine or a paired computer can.",
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

    let instance: WllamaInstance;
    try {
      instance = await this.ensureLoaded(tier);
    } catch (error) {
      return {
        ok: false,
        failure: "error",
        reason: `OCADE's compatibility engine could not start: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    const startedAt = Date.now();
    let firstTokenMs: number | null = null;

    try {
      // `abortSignal` is wllama's own, so cancelling stops the computation
      // inside WebAssembly rather than merely detaching this loop from it.
      const stream = await instance.createChatCompletion({
        stream: true,
        abortSignal: handlers.signal,
        // These are the same values the demo pins in its answer receipt. They
        // must govern the real compatibility runtime too; otherwise a repeat
        // claims fixed conditions that were never actually applied.
        temperature: 0.2,
        top_p: 0.9,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      for await (const chunk of stream) {
        /*
         * Checked before delivering, not just before requesting more. Measured:
         * without this, one already-decoded token still reached the caller
         * after abort, so a stopped answer visibly grew by a word. Generation
         * had genuinely halted — this is purely about not showing a token the
         * user has said they no longer want.
         */
        if (handlers.signal?.aborted) break;
        const piece = chunk.choices?.[0]?.delta?.content;
        if (piece) {
          if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
          handlers.onToken(piece);
        }
      }

      if (handlers.signal?.aborted) {
        return { ok: false, failure: "cancelled", reason: "Stopped." };
      }
      if (firstTokenMs !== null) recordBenchmark("wasm", tier.rank, firstTokenMs);
      return { ok: true, modelId: this.loadedRepo, firstTokenMs };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (handlers.signal?.aborted || name === "WllamaAbortError" || name === "AbortError") {
        return { ok: false, failure: "cancelled", reason: "Stopped." };
      }
      /*
       * A tier that died here must not be offered again — see the matching
       * note in browser-webgpu.ts. Rank 0 is exempt: there is nothing smaller
       * to fall back to, and marking the only available engine as failed would
       * leave the device with none.
       */
      if (tier.rank > 0) recordTierFailure("wasm", tier.rank);
      return {
        ok: false,
        failure: "error",
        reason: `OCADE's compatibility engine stopped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async dispose(): Promise<void> {
    try {
      await this.instance?.exit();
    } catch {
      // Tearing down an engine that already died must not throw.
    }
    this.instance = null;
    this.loadedRepo = null;
  }
}
