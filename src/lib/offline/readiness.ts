/**
 * Can OCADE actually answer with the network switched off?
 *
 * THE CLAIM THIS POLICES. OCADE tells people it works offline. That is four
 * separate things being true at once, and the product has historically had a
 * way of checking one of them and reporting all four:
 *
 *   1. THE SHELL opens with no connection      — a service worker
 *   2. THE RUNTIME can execute                 — the engine's WASM binary cached
 *   3. THE WEIGHTS are on this device          — a verified model in OPFS
 *   4. STORAGE will not be reclaimed           — persistent storage granted
 *
 * "The browser supports WebGPU" answers none of them. A machine with a perfect
 * WebGPU implementation and no downloaded weights cannot answer a single
 * question on a plane, and telling its owner it works offline is a promise that
 * breaks at the exact moment they were relying on it — which is the worst
 * possible moment, because by then there is no network to fix it with.
 *
 * So every gap is named individually, in the user's terms, with the action that
 * closes it. `ready` is true only when there is nothing left to name.
 *
 * WHY (4) COUNTS AS A GAP AND NOT A WARNING. Without persistence the browser
 * may evict a multi-gigabyte download the next time the disk fills. The weights
 * are present today and may be gone tomorrow with no notice and no network to
 * replace them. Reporting that as "ready" is reporting a coin flip as a fact.
 */

export type OfflineGap =
  | "no_service_worker"
  | "shell_not_cached"
  | "runtime_not_cached"
  | "no_model"
  | "model_unverified"
  | "storage_evictable";

export interface OfflineInputs {
  /** A service worker is registered and controlling this page. */
  serviceWorkerActive: boolean;
  /** The shell cache holds entries — the app can open with no network. */
  shellCachedEntries: number;
  /** The engine's WASM runtime has been fetched at least once. */
  runtimeCached: boolean;
  /** Models present in on-device storage. */
  models: Array<{ key: string; bytes: number; verified: boolean }>;
  /** The browser promised not to evict this origin's data. */
  persistent: boolean;
}

export interface OfflineReadiness {
  /** True only when nothing is missing. Never a partial yes. */
  ready: boolean;
  gaps: OfflineGap[];
  /** One sentence, true in every branch. */
  summary: string;
  /** What the app can open to, even when it cannot answer. */
  canOpenOffline: boolean;
  /** What the app can answer with. Requires weights, not just capability. */
  canAnswerOffline: boolean;
}

/** Plain-language name and remedy for each gap. */
export function describeGap(gap: OfflineGap): { title: string; action: string } {
  switch (gap) {
    case "no_service_worker":
      return {
        title: "The app cannot open without a connection",
        action:
          "This browser has not installed OCADE's offline shell. Private browsing and some managed profiles block it.",
      };
    case "shell_not_cached":
      return {
        title: "Nothing is cached yet",
        action: "Use OCADE once while online and the app itself will be kept on this device.",
      };
    case "runtime_not_cached":
      return {
        title: "The engine runtime is not on this device",
        action: "Ask OCADE one question while online. The runtime is kept after the first use.",
      };
    case "no_model":
      return {
        title: "No engine is installed",
        action:
          // No longer "the one part that cannot happen offline" — that was true
          // only while downloading was the sole route to an engine. Both are
          // named because a device that can never connect needs the second one,
          // and it is the only sentence on this screen that will help it.
          "Download an engine in Settings → Local Intelligence, or install one from a file on this device in Settings → Offline Storage.",
      };
    case "model_unverified":
      return {
        title: "The installed engine is incomplete",
        action:
          "It did not finish arriving, or did not match its fingerprint. Download it again, or install it from a file.",
      };
    case "storage_evictable":
      return {
        title: "The download could be cleared automatically",
        action:
          "Ask the browser to keep it, in Settings → Offline Storage. Without that it may be deleted when the device is low on space.",
      };
  }
}

/**
 * Assess, naming every gap rather than the first one found.
 *
 * Returning only the first gap would send a user round a loop: fix it, be told
 * about the next, fix that, be told about a third. They deserve the whole list
 * at once, because some of it can only be done while there is still a network.
 */
export function assessOffline(input: OfflineInputs): OfflineReadiness {
  const gaps: OfflineGap[] = [];

  if (!input.serviceWorkerActive) gaps.push("no_service_worker");
  else if (input.shellCachedEntries === 0) gaps.push("shell_not_cached");

  if (!input.runtimeCached) gaps.push("runtime_not_cached");

  const verified = input.models.filter((m) => m.verified && m.bytes > 0);
  if (input.models.length === 0) gaps.push("no_model");
  else if (verified.length === 0) gaps.push("model_unverified");

  // Only meaningful once something is actually stored: telling a user their
  // nothing might be evicted is noise.
  if (verified.length > 0 && !input.persistent) gaps.push("storage_evictable");

  const canOpenOffline = input.serviceWorkerActive && input.shellCachedEntries > 0;
  const canAnswerOffline = verified.length > 0 && input.runtimeCached;
  const ready = gaps.length === 0;

  return {
    ready,
    gaps,
    canOpenOffline,
    canAnswerOffline,
    summary: summarise({ ready, canOpenOffline, canAnswerOffline, gaps }),
  };
}

function summarise(state: {
  ready: boolean;
  canOpenOffline: boolean;
  canAnswerOffline: boolean;
  gaps: OfflineGap[];
}): string {
  if (state.ready) {
    return "OCADE works with no connection: it opens, and it answers on this device.";
  }
  if (state.canOpenOffline && state.canAnswerOffline) {
    // Everything works, but something could still be taken away.
    return "OCADE opens and answers without a connection. One thing is not yet guaranteed to survive — see below.";
  }
  if (state.canOpenOffline) {
    // The precise, common, honest middle state.
    return "OCADE opens without a connection, but it cannot answer yet. Answering offline needs an engine downloaded to this device.";
  }
  if (state.canAnswerOffline) {
    return "OCADE can answer on this device, but the app itself still needs a connection to open.";
  }
  return "OCADE cannot work without a connection yet.";
}

/**
 * Which cached entries count as the engine runtime.
 *
 * Matched on the URL because that is what Cache Storage stores. Kept beside
 * `assessOffline` so the definition of "the runtime is cached" lives in one
 * place rather than being re-guessed at each call site.
 */
export function isRuntimeAsset(url: string): boolean {
  return /\.wasm(\?|$)/.test(url) || /wllama|webllm|tokenizer/i.test(url);
}
