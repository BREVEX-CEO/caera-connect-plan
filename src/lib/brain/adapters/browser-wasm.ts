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
import {
  planThreads,
  readThreadSignals,
  readThreadOutcome,
  type ThreadOutcome,
} from "../wasm-threads";

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
 * ON THREADS, AND WHAT THE OLD NOTE HERE GOT WRONG
 *
 * This used to say OCADE could not enable cross-origin isolation because COOP
 * `same-origin` severs `window.opener` and would break the sign-in popups "this
 * product depends on". Two things about that were false by the time it was
 * read:
 *
 *  - Sign-in does not use a popup on the deployed site. The auth SDK takes a
 *    popup only when OCADE is inside an IFRAME, and production sends
 *    `frame-ancestors 'none'` and `X-Frame-Options: DENY`, so it cannot be. The
 *    live path is a full-page redirect to `/auth/callback`, which COOP does not
 *    touch.
 *  - The binary was never the constraint either. wllama 3.x ships ONE unified
 *    `wllama.wasm`; multi-thread mode is a runtime decision that needs
 *    `SharedArrayBuffer`. The library's own multithreaded example server
 *    differs from its single-threaded one only by two response headers.
 *
 * So threads are a HEADERS problem, and `security/isolation.ts` solves it by
 * isolating the routes that run inference while leaving auth and the landing
 * page alone. This adapter asks for the cores that policy permits and reports
 * what it actually got; the single-threaded path is always underneath.
 */

type WllamaModule = typeof import("@wllama/wllama");
type WllamaInstance = InstanceType<WllamaModule["Wllama"]>;

export interface WasmProgress {
  fraction: number | null;
  text: string;
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
  /** What the runtime actually did, once a model is loaded. */
  private threadOutcome: ThreadOutcome = { multithreaded: false, threads: 1 };

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
    /**
     * Ask for several processor cores when the platform genuinely allows it.
     *
     * NOT a different binary. wllama 3.x ships ONE `wllama.wasm` that runs
     * single-threaded or multi-threaded depending on `n_threads` and on whether
     * `SharedArrayBuffer` is usable, which needs cross-origin isolation. The
     * previous code here probed for a `multi-thread/wllama.wasm` that this
     * version does not ship and cannot ship, and reported "no multi-core
     * engine" for a reason that had stopped being the reason years ago. The
     * headers were always the constraint.
     */
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
      /*
       * The real decision, not merely "SharedArrayBuffer exists". It can exist
       * on a page that is not isolated, where the threaded build cannot use it
       * — reporting that as multithreaded was true of the symbol and false of
       * the engine.
       */
      multiThreaded: this.loadParams().n_threads > 1,
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

  /**
   * The load parameters, and the only place a thread count is decided.
   *
   * `n_threads` is passed EXPLICITLY rather than left to the library's default
   * of `floor(hardwareConcurrency / 2)`. The default is a reasonable guess about
   * a desktop and a poor one about a phone, where `hardwareConcurrency` counts
   * efficiency cores that are much slower than the performance ones — and it
   * knows nothing about how much memory the device has to give each thread.
   * `planThreads` weighs all three.
   *
   * Passing 1 is not "multithreaded with one thread": wllama hands 0 to its
   * worker at that point, which disables pthreads outright.
   */
  private loadParams(): { n_threads: number; n_gpu_layers: number } {
    const plan = planThreads({
      ...readThreadSignals(),
      // The ladder decides whether this rung is the threaded one at all; asking
      // for cores on the single-threaded rung would contradict the choice the
      // installation authority already made.
      isolated: this.preferThreads ? readThreadSignals().isolated : false,
    });
    return {
      n_threads: plan.threads,
      /*
       * ZERO, EXPLICITLY, AND IT IS NOT REDUNDANT.
       *
       * wllama defaults `n_gpu_layers` to 99999 — every layer on the graphics
       * card. It happens to be inert today: `scripts/e2e/browser-engine-modes.mjs`
       * asks this exact binary for 99 layers on a machine whose browser grants
       * a working WebGPU device, and llama.cpp reports one registered backend
       * and assigns every layer to the processor. The unified build this
       * deployment bundles is processor-only, whatever it is asked for.
       *
       * Leaving the default in place would make that an accident rather than a
       * decision. A future binary that did register a graphics backend would
       * silently start offloading here — on the rung the authority chose
       * PRECISELY BECAUSE the graphics rung was refused or had failed, and
       * alongside the graphics engine when it had not. Two engines competing
       * for one card is the defect `shared-browser-engine.ts` exists to
       * prevent, arrived at through a library default nobody set.
       *
       * This rung is the compatibility engine. It runs on the processor.
       */
      n_gpu_layers: 0,
    };
  }

  /**
   * Record what the runtime DID, which is not necessarily what was asked.
   *
   * An isolated page whose browser still fails wllama's own WebAssembly threads
   * probe gets one thread however many were requested. Reporting the request as
   * though it were the outcome is how a diagnostics screen comes to claim four
   * threads on a device running one, so the runtime is asked and its answer is
   * what gets stored.
   */
  private recordThreads(instance: WllamaInstance): void {
    this.threadOutcome = readThreadOutcome(instance);
  }

  /** What the loaded engine is actually running on. Diagnostics only. */
  threads(): ThreadOutcome {
    return this.threadOutcome;
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
    const unifiedWasm = (await import("@wllama/wllama/esm/wasm/wllama.wasm?url")).default;

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
    /*
     * ONE BINARY, AND `default` IS THE ONE THAT MATTERS.
     *
     * wllama 3.x ships a single unified `wllama.wasm` that runs on one core or
     * several, selected at runtime from `n_threads` and from whether
     * `SharedArrayBuffer` is usable. The `single-thread/` and `multi-thread/`
     * keys survive in `AssetsPathConfig` as optional backwards compatibility;
     * `default` is the required one and the only one this build has a file for.
     *
     * It is bundled from `node_modules` and served by this deployment. Nothing
     * here is ever fetched from a third-party CDN: an engine that reaches out
     * to somebody else's host every time it starts is not local-first, and an
     * offline user would find it broken exactly when they needed it.
     */
    const builds: { default: string; "single-thread/wllama.wasm": string } = {
      default: unifiedWasm,
      "single-thread/wllama.wasm": unifiedWasm,
    };

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
      await instance.loadModel([blob], this.loadParams());
      this.recordThreads(instance);
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
      await instance.loadModel([blob], this.loadParams());
      this.recordThreads(instance);
    } else {
      // No OPFS: fall back to the library's own fetch so the engine still
      // works, accepting that it cannot be managed from Settings.
      const entry = resolvedFor(tier);
      if (!entry) throw new Error("This browser tier has no model file configured.");
      await instance.loadModelFromHF(
        { repo: entry.repo, file: entry.path },
        {
          ...this.loadParams(),
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
    this.recordThreads(instance);

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
