/**
 * The OCADE Brain adapter contract.
 *
 * ONE interface, one way of running a model: WebAssembly in the browser, over
 * the artifact OCADE installs and verifies itself. It described five ways
 * once — a desktop bridge, a paired desktop, WebGPU, WebAssembly and a native
 * mobile engine — and four of them belonged to products that no longer exist.
 * The interface survives because Chat must still not know what answered.
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

export type AdapterId = "browser_wasm";

/** Where computation physically happens. Drives the badge and the promise. */
export type AdapterLocality = "on_device";

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
  | "unsupported_device"
  | "insufficient_memory"
  | "insufficient_storage"
  | "no_model"
  | "disabled_by_user"
  | "probe_failed";

/** A remedy the UI can render as a real button. */
export type RemedyAction = "download_model" | "free_storage" | "enable_in_settings";

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
  /**
   * Actions the model may call, in the runtime's own function-call schema.
   *
   * WHY THIS IS HERE RATHER THAN WRITTEN INTO THE PROMPT
   * ----------------------------------------------------
   * Control + Work used to append the whole tool vocabulary to the system
   * message and read JSON back out of the reply text. That works until the
   * model writes JSON that does not parse, and on a 3B model it eventually
   * does. Observed live: `{"tool": "system_status", "arguments": {"}}` — an
   * unterminated object, unparseable, and the run simply ended.
   *
   * Passed as a schema instead, the runtime constrains the shape: the same
   * model produced well-formed calls on every attempt in benchmarking, at
   * about a tenth of the latency. Prose parsing stays as a fallback for
   * adapters with no function-call channel, but it is no longer the contract.
   *
   * Adapters that cannot carry tools ignore this, and the caller falls back.
   */
  tools?: readonly unknown[];
  /** Called once per action the model asks for, before the stream closes. */
  onToolCall?: (call: { id?: string; name: string; arguments: Record<string, unknown> }) => void;
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
export function unavailable(
  code: UnavailableCode,
  reason: string,
  remedies: RemedyAction[] = [],
): AdapterUnavailable {
  return { available: false, code, reason, remedies };
}

/** Human sentence for a remedy, so every surface words it the same way. */
export const REMEDY_LABELS: Record<RemedyAction, string> = {
  download_model: "Prepare Offline Intelligence",
  free_storage: "Free up storage",
  enable_in_settings: "Enable in Settings",
};
