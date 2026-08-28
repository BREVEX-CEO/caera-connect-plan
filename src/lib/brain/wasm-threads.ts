/**
 * How many processor threads OCADE's compatibility engine actually gets.
 *
 * WHAT WAS WRONG BEFORE, AND IT WAS A FACT ABOUT THE LIBRARY RATHER THAN A BUG
 * IN OUR LOGIC.
 *
 * The previous code believed wllama needed a SEPARATE `multi-thread/wllama.wasm`
 * binary, that the installed package did not ship one, and that threads were
 * therefore only available to a deployment that vendored a build from
 * somewhere. It probed `/wasm/multi-thread/wllama.wasm` with a HEAD request and,
 * finding nothing, honestly reported that this deployment had no multi-core
 * engine.
 *
 * That was true of wllama v1. It is not true of the installed v3.5.1, and the
 * evidence is in the package:
 *
 *   - `esm/wasm/` contains exactly ONE binary, `wllama.wasm`, 7.65 MB. There is
 *     no second build to go looking for.
 *   - `scripts/http_server.js` has a `serve:mt` mode whose ONLY difference is
 *     that it sets `Cross-Origin-Embedder-Policy` and
 *     `Cross-Origin-Opener-Policy`. Same files, same binary — the headers are
 *     the whole of what "multi-thread mode" means.
 *   - `loadModel` computes `useMultiThread = supportMultiThread && nbThreads > 1`
 *     at runtime, where `supportMultiThread` is a WebAssembly feature detection
 *     that needs `SharedArrayBuffer`, which needs cross-origin isolation.
 *
 * So the binary was never the constraint. THE HEADERS WERE. The old probe was
 * looking for a file that does not exist and cannot exist, and reporting the
 * absence of threads for a reason that had stopped being the reason.
 *
 * `single-thread/wllama.wasm` and `multi-thread/wllama.wasm` survive in
 * `AssetsPathConfig` as OPTIONAL keys for backwards compatibility; `default` is
 * the required one and is what the unified build is passed as.
 *
 * WHAT THIS FILE DECIDES. Only the thread count, and only from facts. Whether
 * threads are possible at all is `crossOriginIsolated`, which the platform
 * answers and this module does not argue with.
 */

/** What the browser will admit about its own concurrency. */
export interface ThreadSignals {
  /** `navigator.hardwareConcurrency`. Often absent, sometimes a lie. */
  cores?: number | null;
  /** `navigator.deviceMemory`, in GB. Capped at 8 where it exists at all. */
  deviceMemoryGb?: number | null;
  /** True when this looks like a phone or tablet. */
  mobile?: boolean | null;
  /** `crossOriginIsolated` — the only thing that decides whether threads exist. */
  isolated?: boolean | null;
  /** `typeof SharedArrayBuffer === "function"`. */
  sharedArrayBuffer?: boolean | null;
}

export interface ThreadPlan {
  /**
   * Threads to ask the runtime for.
   *
   * ONE MEANS SINGLE-THREADED, and wllama treats it as such: it passes 0 to the
   * worker, which disables pthreads entirely rather than starting a pool of
   * one. So this is never a "multithreaded with one thread" half-state.
   */
  threads: number;
  /** True when the platform genuinely permits more than one. */
  multithreaded: boolean;
  /** Why, for diagnostics only. Never shown in ordinary UI. */
  because: string;
}

/**
 * The ceiling, and it is not `hardwareConcurrency`.
 *
 * Each pthread is a Web Worker with its own stack and its own share of the
 * WebAssembly heap, and llama.cpp's scaling flattens well before the core count
 * on the machines this fallback exists for. Past about eight the extra threads
 * contend for memory bandwidth and the shared heap while making the tab less
 * responsive, so the last few cost battery and give nothing back.
 *
 * wllama's own default is `floor(hardwareConcurrency / 2)` for the same reason.
 * This keeps that shape and bounds it.
 */
export const MAX_THREADS = 8;

/**
 * Threads are never taken from every core.
 *
 * Half, rounded down, matching wllama's own default. The other half is the page
 * the user is looking at: the animation on the setup screen, the compositor,
 * and whatever else the browser is doing. An engine that takes every core makes
 * the product it is part of feel broken while it works.
 */
export function planThreads(signals: ThreadSignals): ThreadPlan {
  const isolated = signals.isolated === true;
  const sab = signals.sharedArrayBuffer !== false;

  if (!isolated) {
    return {
      threads: 1,
      multithreaded: false,
      because: "this page is not cross-origin isolated, so several cores cannot be used",
    };
  }
  if (!sab) {
    return {
      threads: 1,
      multithreaded: false,
      because: "this browser does not provide the shared memory several cores need",
    };
  }

  const cores = signals.cores ?? 0;
  if (!Number.isFinite(cores) || cores < 2) {
    return {
      threads: 1,
      multithreaded: false,
      because:
        cores >= 1
          ? "this device reports a single processor core"
          : "this browser will not say how many processor cores it has",
    };
  }

  let threads = Math.floor(cores / 2);

  /*
   * A PHONE GETS FEWER, and this is not timidity.
   *
   * `hardwareConcurrency` on a phone counts efficiency cores that are much
   * slower than the performance ones, so half of eight is rarely four useful
   * threads — and a thermally throttled phone that has spun up six workers
   * answers more slowly than one that spun up two, while draining the battery
   * to do it. Four is the ceiling where this stops being a good trade.
   */
  if (signals.mobile === true) threads = Math.min(threads, 4);

  /*
   * Low memory is a harder limit than core count.
   *
   * Each thread wants stack and heap in the same WebAssembly memory the weights
   * are already in. On a 2 GB device that is the allocation that kills the tab,
   * and losing the tab costs the whole install.
   */
  const memory = signals.deviceMemoryGb ?? null;
  if (memory !== null && memory <= 2) threads = Math.min(threads, 2);
  else if (memory !== null && memory <= 4) threads = Math.min(threads, 4);

  threads = Math.max(1, Math.min(MAX_THREADS, threads));

  return {
    threads,
    multithreaded: threads > 1,
    because:
      threads > 1
        ? `this page is isolated and the device offers ${cores} cores, so ${threads} are used`
        : "this device does not have enough spare cores to be worth using more than one",
  };
}

/** Read what this browser will say. Never throws. */
export function readThreadSignals(): ThreadSignals {
  if (typeof navigator === "undefined") {
    return { isolated: false, sharedArrayBuffer: false };
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  let mobile: boolean | null = null;
  try {
    mobile =
      typeof nav.userAgent === "string"
        ? /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(nav.userAgent)
        : null;
  } catch {
    mobile = null;
  }
  return {
    cores: nav.hardwareConcurrency ?? null,
    deviceMemoryGb: nav.deviceMemory ?? null,
    mobile,
    isolated: globalThis.crossOriginIsolated === true,
    sharedArrayBuffer: typeof SharedArrayBuffer === "function",
  };
}

/**
 * What the runtime actually did, read back from it after loading.
 *
 * ASKED RATHER THAN ASSUMED, and that distinction is the whole reason this
 * exists. `planThreads` says what OCADE wants; wllama's own feature detection
 * decides what it gets, and the two can legitimately disagree — an isolated
 * page whose browser still fails the WebAssembly threads probe gets one thread
 * no matter what was requested. Reporting the request as though it were the
 * outcome is how a diagnostic surface comes to claim four threads on a device
 * running one.
 */
export interface ThreadOutcome {
  multithreaded: boolean;
  threads: number;
}

export function readThreadOutcome(instance: {
  isMultithread?: () => boolean;
  getNumThreads?: () => number;
}): ThreadOutcome {
  try {
    const multithreaded = instance.isMultithread?.() ?? false;
    const threads = instance.getNumThreads?.() ?? 1;
    return { multithreaded, threads: Number.isFinite(threads) ? threads : 1 };
  } catch {
    // Only valid after a model is loaded; before that the honest answer is the
    // conservative one.
    return { multithreaded: false, threads: 1 };
  }
}
