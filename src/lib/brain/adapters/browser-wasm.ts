import {
  unavailable,
  type AdapterAvailability,
  type BrainAdapter,
  type BrainMessage,
  type BrainStreamHandlers,
  type BrainStreamResult,
} from "../adapter";
import { BROWSER_SAMPLER } from "@/lib/brain/sampler-settings";
import { OFFLINE_LABEL, formatSize, offlineRelease, type OfflineRelease } from "../offline-release";
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
  private loadedRelease: string | null = null;
  private cachedModel: OfflineRelease | null = null;
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
     * treated as unknown, and preparation goes ahead.
     */
    const model = offlineRelease();
    if (!model) {
      return unavailable(
        "no_model",
        "Offline Intelligence is not available in this version of OCADE yet.",
      );
    }
    let quotaBytes: number | null = null;
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (estimate?.quota !== undefined) {
        quotaBytes = Math.max(0, estimate.quota - (estimate.usage ?? 0));
      }
    } catch {
      quotaBytes = null;
    }
    if (quotaBytes !== null && quotaBytes < model.totalBytes) {
      return unavailable(
        "insufficient_storage",
        `Offline Intelligence needs about ${formatSize(
          model.totalBytes,
        )} and this browser will only allow ${formatSize(quotaBytes)}.`,
        ["free_storage"],
      );
    }

    this.cachedModel = model;
    return {
      available: true,
      label: OFFLINE_LABEL,
      locality: "on_device",
      // The opaque release id, never a model name. It reaches diagnostics and
      // nothing else.
      modelId: model.releaseId,
      thinkingSuitable: model.thinkingSuitable,
      capabilities: { text: true, vision: false, imageGeneration: false, tools: false },
    };
  }

  plan(): { model: OfflineRelease; downloadLabel: string; multiThreaded: boolean } | null {
    if (!this.cachedModel) return null;
    return {
      model: this.cachedModel,
      downloadLabel: formatSize(this.cachedModel.totalBytes),
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
      await this.ensureLoaded(chosen.model);
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
    await this.ensureLoaded(chosen.model);
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

  /**
   * Load the artifact the installation authority already verified.
   *
   * ONE DOWNLOADER, AND IT IS NOT THIS ONE. This used to carry a second
   * transfer path of its own — probe a same-origin copy, otherwise fetch the
   * publisher's host, otherwise hand the repository and file name to the
   * library's own downloader, which fetched them from a public model host in
   * the customer's browser. Three ways to acquire one artifact, one of them
   * publishing exactly the identity `CLAUDE.md` says a customer must never
   * meet.
   *
   * The installation authority owns acquisition now: it mints an authorised
   * link, transfers in resumable parallel ranges, checks the digest and stores
   * the result. By the time this runs the bytes are on the device, so this
   * reads them and starts an engine. Without a provider there is nothing to
   * start, and saying so is the honest answer.
   */
  private async ensureLoaded(model: OfflineRelease): Promise<WllamaInstance> {
    if (this.instance && this.loadedRelease === model.releaseId) return this.instance;
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
    if (!this.weightsProvider) {
      throw new Error("Offline Intelligence has not been prepared on this device yet.");
    }
    const blob = await this.weightsProvider();
    if (!blob) {
      throw new Error("OCADE's prepared engine could not be read back from this device.");
    }
    await instance.loadModel([blob], this.loadParams());
    this.recordThreads(instance);

    this.instance = instance;
    this.loadedRelease = model.releaseId;
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
    const model = this.cachedModel;
    if (!model) {
      return { ok: false, failure: "unavailable", reason: "No browser engine was selected." };
    }

    let instance: WllamaInstance;
    try {
      instance = await this.ensureLoaded(model);
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
        // The sampling values the answer receipt pins, read from the one
        // place they are decided. A pin that names conditions the runtime
        // never applied is worse than no pin at all.
        temperature: BROWSER_SAMPLER.temperature,
        top_p: BROWSER_SAMPLER.topP,
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
      return { ok: true, modelId: this.loadedRelease, firstTokenMs };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (handlers.signal?.aborted || name === "WllamaAbortError" || name === "AbortError") {
        return { ok: false, failure: "cancelled", reason: "Stopped." };
      }
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
    this.loadedRelease = null;
  }
}
