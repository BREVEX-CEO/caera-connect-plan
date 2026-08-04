/**
 * The OCADE Brain adapter contract.
 *
 * ONE interface, five ways of running a model: the desktop engine behind an
 * authenticated bridge, a paired desktop reached over the network, WebGPU in
 * the browser, WebAssembly in the browser, and a native model on a phone.
 * The chat screen must not know which of those answered — if it does, every
 * future engine becomes a UI change too.
 *
 * WHAT AN ADAPTER MUST GUARANTEE
 *
 * 1. `probe()` NEVER LIES AND NEVER THROWS. It returns what is true right now,
 *    including "I cannot tell". An adapter that reports itself ready and then
 *    fails on the first token is worse than one that reports unavailable,
 *    because the router has already committed by then.
 * 2. `stream()` RESOLVES, it does not reject. A failure is a value with a
 *    reason a person can act on. Exceptions lose that on the way up.
 * 3. CANCELLATION IS REAL. An aborted signal must stop the underlying
 *    computation, not merely stop delivering tokens to the caller. Anything
 *    less keeps a phone warm and a laptop fan spinning after the user pressed
 *    stop.
 * 4. NOTHING LEAVES THE DEVICE unless `locality` says so. That field is the
 *    product's central promise expressed as a type.
 */

export type AdapterId =
  | "desktop_bridge"
  | "paired_desktop"
  | "browser_webgpu"
  | "browser_wasm"
  | "mobile_native"
  | "cloud";

/** Where computation physically happens. Drives the badge and the promise. */
export type AdapterLocality =
  /** This machine, this process. */
  | "on_device"
  /** Another machine the user owns, reached directly. Still not a service. */
  | "paired_device"
  /** Someone else's servers. */
  | "remote";

export interface AdapterCapabilities {
  text: boolean;
  /** Genuine image understanding, not filename guessing. */
  vision: boolean;
  /** Can produce images. Almost always false. */
  imageGeneration: boolean;
  /** Supports tool/function calling. */
  tools: boolean;
}

export type UnavailableCode =
  | "not_installed"
  | "not_running"
  | "not_paired"
  | "unsupported_device"
  | "insufficient_memory"
  | "insufficient_storage"
  | "no_model"
  | "disabled_by_user"
  | "probe_failed";

/** A remedy the UI can render as a real button. */
export type RemedyAction =
  | "install_ocade"
  | "pair_a_computer"
  | "download_model"
  | "start_engine"
  | "free_storage"
  | "enable_in_settings";

export interface AdapterUnavailable {
  available: false;
  code: UnavailableCode;
  /** One sentence, shown verbatim. Never a code, never a stack trace. */
  reason: string;
  /** What the user can actually do. Empty means genuinely nothing. */
  remedies: RemedyAction[];
}

export interface AdapterReady {
  available: true;
  /** Capability label — "OCADE Local", never a raw model id. */
  label: string;
  locality: AdapterLocality;
  capabilities: AdapterCapabilities;
  /** Raw model identifier, for diagnostics and About only. */
  modelId: string | null;
  /**
   * Measured first-token latency where known, so the router can prefer a
   * genuinely faster adapter rather than a nominally better one.
   */
  measuredFirstTokenMs?: number | null;
}

export type AdapterAvailability = AdapterReady | AdapterUnavailable;

export interface BrainMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** Base64 image payloads, no data-URL prefix. Only for vision adapters. */
  images?: string[];
}

export interface BrainStreamHandlers {
  onToken: (chunk: string) => void;
  signal?: AbortSignal;
  /**
   * Hidden reasoning. Off by default because it was measured to be the
   * difference between a usable chat and one that looks frozen on CPU-only
   * hardware — 163s to first visible character against 28s warm.
   */
  think?: boolean;
}

export type BrainStreamResult =
  | { ok: true; modelId: string | null; firstTokenMs: number | null }
  | { ok: false; failure: "cancelled" | "unavailable" | "error"; reason: string };

export interface BrainAdapter {
  readonly id: AdapterId;
  /** Shown in diagnostics. The capability label lives on the availability. */
  readonly displayName: string;
  /**
   * Report readiness. Cheap and cached by the caller — this may be called on
   * every route decision, so it must not download or load weights.
   */
  probe(): Promise<AdapterAvailability>;
  /** Stream a reply. Resolves with a result; never rejects. */
  stream(messages: BrainMessage[], handlers: BrainStreamHandlers): Promise<BrainStreamResult>;
  /**
   * Release whatever this adapter is holding — weights, workers, sockets.
   * Called when the user switches engines or leaves the screen, so a browser
   * tab does not sit on a gigabyte of GPU memory it is no longer using.
   */
  dispose?(): Promise<void>;
}

/** Convenience for adapters that are simply not present on this platform. */
export function unavailable(
  code: UnavailableCode,
  reason: string,
  remedies: RemedyAction[] = [],
): AdapterUnavailable {
  return { available: false, code, reason, remedies };
}

/** Human sentence for a remedy, so every surface words it the same way. */
export const REMEDY_LABELS: Record<RemedyAction, string> = {
  install_ocade: "Install OCADE",
  pair_a_computer: "Pair a computer",
  download_model: "Download the engine",
  start_engine: "Start the engine",
  free_storage: "Free up storage",
  enable_in_settings: "Enable in settings",
};
