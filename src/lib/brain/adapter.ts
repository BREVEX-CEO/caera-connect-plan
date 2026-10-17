/**
 * The OCADE Brain adapter contract.
 *
 * ONE interface, one way of running a model: WebAssembly in the browser, over
 * the artifact OCADE installs and verifies itself. Chat must not know what
 * answered.
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
 */

export interface AdapterCapabilities {
  text: boolean;
  /** Genuine image understanding, not filename guessing. */
  vision: boolean;
  /** Supports tool/function calling. */
  tools: boolean;
}

export interface AdapterUnavailable {
  available: false;
  /** One sentence, shown verbatim. Never a code, never a stack trace. */
  reason: string;
}

export interface AdapterReady {
  available: true;
  /** Capability label — "OCADE Local", never a raw model id. */
  label: string;
  capabilities: AdapterCapabilities;
  /** Raw model identifier, for diagnostics and About only. */
  modelId: string | null;
  /**
   * Whether Thinking is worth running on whatever this adapter actually
   * loaded. Absent means yes.
   *
   * A switch that is always available is a promise the weakest engine cannot
   * keep. The compatibility tier runs on the processor, where deliberating
   * multiplies the tokens produced without improving the answer, so the engine
   * that knows what it loaded says so and Chat degrades to Fast openly rather
   * than leaving a decorative toggle on a page that then appears to hang.
   */
  thinkingSuitable?: boolean;
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
  /**
   * Report readiness. Cheap and cached by the caller — this may be called on
   * every route decision, so it must not download or load weights.
   */
  probe(): Promise<AdapterAvailability>;
  /** Stream a reply. Resolves with a result; never rejects. */
  stream(messages: BrainMessage[], handlers: BrainStreamHandlers): Promise<BrainStreamResult>;
  /** Optionally prepare weights before the first send. Must be idempotent. */
  preload?(): Promise<void>;
  /**
   * Release whatever this adapter is holding — weights, workers, sockets.
   * Called when the user switches engines or leaves the screen, so a browser
   * tab does not sit on a gigabyte of GPU memory it is no longer using.
   */
  dispose?(): Promise<void>;
}

/** Convenience for adapters that are simply not present on this platform. */
export function unavailable(reason: string): AdapterUnavailable {
  return { available: false, reason };
}
