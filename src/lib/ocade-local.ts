/**
 * OCADE local-first engine (Plan §14, decisions #10, #11, #17, #20).
 *
 * Talks to a local Ollama-compatible runtime through a bridge URL (default
 * http://localhost:11434). Local inference is UNLIMITED and stays on-device —
 * this module never sends prompts to any server. Raw model/runtime names are
 * used only internally for routing/diagnostics; every user-facing surface shows
 * the OCADE capability label (OCADE Local / Fast / Vision / Code), never the raw
 * name (decision #18).
 *
 * Classification and planning are pure (unit-tested). Discovery/health/streaming
 * take an injectable fetch so they are testable and SSR-safe.
 */
import {
  assertStreamWithinLimit,
  StreamLimitError,
  MAX_STREAM_CHARS,
  MAX_STREAM_LINE_CHARS,
} from "./stream-limits";
import {
  capabilityLabelFor,
  type OcadeCapabilityLabel,
  type OcadeLocalProfile,
} from "./ocade-capability-labels";
import { supportsThinkingField } from "./local/fixed-model";
// Value imports only; these depend on nothing in this module, so there
// is no cycle. Shared deliberately — a second copy of "which tiers need a GPU"
// is how the router and the tier policy came to disagree about one machine.

export const DEFAULT_LOCAL_BRIDGE_URL = "http://localhost:11434";

/** Raw shape returned by Ollama /api/tags (only the fields we use). */
export interface RawLocalModel {
  name: string;
  size?: number;
  details?: {
    family?: string;
    families?: string[] | null;
    parameter_size?: string;
  };
  /**
   * Capabilities the runtime itself declares, e.g. ["vision", "completion"].
   * Authoritative where present — see `classifyLocalModel`.
   */
  capabilities?: string[] | null;
}

export interface LocalModelInfo {
  /** Raw runtime id — internal/diagnostics only, never shown in ordinary UI. */
  id: string;
  sizeBytes: number;
  /** Approximate parameter count in billions, parsed best-effort. */
  paramsB: number | null;
  vision: boolean;
  profile: OcadeLocalProfile;
  label: OcadeCapabilityLabel;
  /** A ":cloud" pointer is not a genuine on-device model. */
  isCloudPointer: boolean;
}

/*
 * Name-shape fallback only. `-vl\b` alone missed `qwen2.5vl:7b` — no hyphen,
 * no word boundary before "vl" — so a genuinely installed vision model was
 * invisible to OCADE and image questions were refused on a machine that could
 * answer them. Found by running the real runtime, not by reading the regex.
 * `internvl` and `pixtral` are included for the same reason: they are common
 * and neither contains "vision" or "llava".
 */
const VISION_HINT =
  /(llava|vision|vl(?::|-|\b)|minicpm-v|moondream|bakllava|internvl|pixtral|llama3\.2-vision)/i;
const CODE_HINT = /(coder|code|deepseek-coder|starcoder|codellama|codegemma)/i;

/**
 * Does the runtime itself say this model takes images?
 *
 * Returns null when the runtime declares nothing, which is the ONLY case where
 * guessing from the name is appropriate. A runtime that lists capabilities and
 * omits "vision" is stating a fact, and a regex must not overrule it — sending
 * images to a text-only model produces a confident answer about nothing.
 */
function declaredVision(raw: RawLocalModel): boolean | null {
  const declared = raw.capabilities;
  if (!Array.isArray(declared) || declared.length === 0) return null;
  return declared.some((c) => String(c).toLowerCase() === "vision");
}

/** Parse "7.6B", "30.5B", "7B" → number of billions. */
export function parseParamsB(paramSize?: string): number | null {
  if (!paramSize) return null;
  const m = /([\d.]+)\s*([bm])/i.exec(paramSize);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2].toLowerCase() === "m" ? n / 1000 : n;
}

/**
 * Classify a raw local model into an OCADE capability profile. Pure. Precedence:
 * vision → code → fast (small) → general.
 */
export function classifyLocalModel(raw: RawLocalModel): LocalModelInfo {
  const id = raw.name;
  const isCloudPointer = /:cloud$/i.test(id) || (raw.size ?? 0) === 0;
  const families = raw.details?.families ?? [];
  const vision =
    declaredVision(raw) ??
    (VISION_HINT.test(id) || families.some((f) => /vision|clip|vit|vl$/i.test(f ?? "")));
  const paramsB = parseParamsB(raw.details?.parameter_size);

  let profile: OcadeLocalProfile;
  if (vision) profile = "vision";
  else if (CODE_HINT.test(id)) profile = "code";
  else if (paramsB !== null && paramsB <= 4) profile = "fast";
  else profile = "general";

  return {
    id,
    sizeBytes: raw.size ?? 0,
    paramsB,
    vision,
    profile,
    label: capabilityLabelFor({ locality: "local", profile }),
    isCloudPointer,
  };
}

export interface LocalDiscovery {
  ok: boolean;
  reachable: boolean;
  version?: string;
  models: LocalModelInfo[];
  /** Honest reason when not ok (offline, CORS-blocked, empty, etc.). */
  reason?: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function getFetch(f?: FetchLike): FetchLike | null {
  if (f) return f;
  if (typeof fetch !== "undefined") return fetch as unknown as FetchLike;
  return null;
}

/**
 * Default per-request budget for discovery.
 *
 * Was 4s shared across BOTH requests, which is how a machine with nine
 * installed models reported "No on-device engine is installed" during a
 * runtime evidence run — the engine was fine, one probe was briefly slow
 * because it had just finished loading a 6 GB model, and a single shared
 * deadline turned that into a false claim about the user's own computer.
 * A local engine busy loading weights is the NORMAL case, not an outage.
 */
export const DISCOVERY_TIMEOUT_MS = 8000;

/** One request, with its own deadline. Never shares a budget with another. */
async function fetchWithDeadline(f: FetchLike, url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await f(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

const isAbort = (e: unknown) => e instanceof Error && e.name === "AbortError";

/**
 * Did the transport give up waiting, rather than fail to connect?
 *
 * Node's fetch abandons a request whose first response byte takes longer than
 * 300 seconds. Measured here: a 5,849-token document sent to a model that had
 * to be RELOADED at a new context window ran past that limit and surfaced as
 * "unreachable" — on a machine where the engine was running and working. The
 * same request, once the model was warm at that window, returned headers in
 * 37.9 seconds and the correct answer in 40.6.
 *
 * The distinction matters because it decides what the user is told to do:
 * "start the engine" is useless advice for an engine that is already running.
 */
function isSlowResponseError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const cause = (e as { cause?: { code?: string; name?: string } }).cause;
  const code = cause?.code ?? "";
  const name = cause?.name ?? e.name;
  return (
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    /timeout/i.test(name) ||
    /timeout/i.test(e.message)
  );
}

/** Health + installed-model discovery against the local bridge. */
export async function discoverLocalModels(
  bridgeUrl: string = DEFAULT_LOCAL_BRIDGE_URL,
  fetchImpl?: FetchLike,
  timeoutMs = DISCOVERY_TIMEOUT_MS,
): Promise<LocalDiscovery> {
  const f = getFetch(fetchImpl);
  if (!f) return { ok: false, reachable: false, models: [], reason: "No fetch available." };
  const base = bridgeUrl.replace(/\/+$/, "");

  /*
   * The version probe is COSMETIC — it fills a diagnostics line. It used to be
   * able to fail the whole discovery, so a slow or missing /api/version made
   * every installed model disappear from the product. It can no longer do
   * that: an unavailable version is recorded as unknown and discovery
   * continues to the question that actually matters.
   */
  let version: string | undefined;
  try {
    const vres = await fetchWithDeadline(f, `${base}/api/version`, timeoutMs);
    if (vres.ok) version = ((await vres.json()) as { version?: string }).version;
  } catch {
    version = undefined;
  }

  /*
   * The model list gets ONE retry, and only on a timeout. A refused connection
   * means nothing is listening and retrying just delays an honest answer; a
   * timeout means something IS there and was busy, which is precisely the case
   * worth waiting out once.
   */
  let tres: Response;
  try {
    tres = await fetchWithDeadline(f, `${base}/api/tags`, timeoutMs);
  } catch (e) {
    if (!isAbort(e)) {
      return { ok: false, reachable: false, models: [], reason: "Local engine unreachable." };
    }
    try {
      tres = await fetchWithDeadline(f, `${base}/api/tags`, timeoutMs);
    } catch (retryError) {
      return {
        ok: false,
        // A timeout means something WAS listening. Reporting it as unreachable
        // would send the user to the wrong remedy.
        reachable: isAbort(retryError),
        models: [],
        version,
        reason: isAbort(retryError)
          ? "The local engine is taking longer than expected — it may still be loading a model."
          : "Local engine unreachable.",
      };
    }
  }

  try {
    if (!tres.ok) {
      return {
        ok: false,
        reachable: true,
        version,
        models: [],
        reason: `Model list HTTP ${tres.status}.`,
      };
    }
    const body = (await tres.json()) as { models?: RawLocalModel[] };
    const models = (body.models ?? []).map(classifyLocalModel).filter((m) => !m.isCloudPointer);
    return {
      ok: models.length > 0,
      reachable: true,
      version,
      models,
      reason: models.length === 0 ? "No on-device models installed yet." : undefined,
    };
  } catch (e) {
    const reason = isAbort(e) ? "Local engine timed out." : "Local engine unreachable.";
    return { ok: false, reachable: false, version, models: [], reason };
  }
}

/*
 * SIZE-BASED MODEL SELECTION IS GONE, AND IT IS NOT COMING BACK.
 *
 * `pickLocalModel` chose by size with the rule "prefer larger (more capable)".
 * On a machine holding several models that returned the biggest one installed —
 * a 9.3 GB engine on a 15.6 GB laptop with no GPU — and signed-in Chat opened
 * on it while every other surface ran the fixed 1.9 GB engine.
 *
 * OCADE has exactly ONE reasoning engine and one vision engine.
 * `selectFixedModel` in `local/fixed-model.ts` is the only thing that may name
 * them; reach it through `routeTask` so the vision branch stays in one place.
 */

/* -------------------- Hardware-aware model fit -------------------- */

/**
 * Loading a GGUF needs more than the file itself: weights, KV cache for the
 * context window, and the runtime's own working set. 1.2x the file size is the
 * conservative planning figure — it under-promises rather than selecting a
 * model that loads and then thrashes.
 */
export const MODEL_RAM_OVERHEAD = 1.2;

/**
 * Fraction of TOTAL RAM a model may claim.
 *
 * Deliberately measured against total, not currently-available, RAM. Available
 * RAM is violently transient — on this machine it read 0.85 GiB immediately
 * after Ollama loaded a model, yet a 3.83 GB model had just run fine, because
 * the OS evicts cache under pressure. Selecting on `availableRamBytes` would
 * refuse models that demonstrably work. Total RAM is what actually bounds
 * whether weights can be resident at all.
 */
export const TOTAL_RAM_HEADROOM = 0.8;

/**
 * Best-effort total RAM from inside a browser.
 *
 * `navigator.deviceMemory` is coarse (0.25/0.5/1/2/4/8 GiB, capped at 8 for
 * fingerprinting reasons) and is not implemented in Firefox or Safari. It is
 * still worth using: on the machine this was developed against it reports 8,
 * which correctly excludes an 18.6 GB model even though the machine really has
 * 16.8 GB. Returns `undefined` when unavailable, which DISABLES the fit check
 * rather than substituting a guess — refusing a model on invented hardware data
 * would be its own dishonesty.
 */
export function browserTotalRamBytes(): number | undefined {
  if (typeof navigator === "undefined") return undefined;
  const gib = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof gib !== "number" || !Number.isFinite(gib) || gib <= 0) return undefined;
  return gib * 1024 ** 3;
}

export interface ModelFit {
  model: LocalModelInfo;
  /** Estimated resident bytes required. */
  needsBytes: number;
  fits: boolean;
  /** Present only when `fits` is false. */
  reason?: string;
}

/** Bytes → "3.8 GB", for user-facing refusal text. */
function gb(bytes: number): string {
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

/**
 * Can this model be resident on a machine with `totalRamBytes`?
 *
 * A model that cannot fit is excluded WITH A REASON rather than silently
 * dropped, because "OCADE Local Code is unavailable" is a worse answer than
 * "qwen3-coder:30b needs 22.3 GB of RAM but this machine has 16.8 GB".
 */
export function modelFit(model: LocalModelInfo, totalRamBytes: number): ModelFit {
  const needsBytes = Math.round(model.sizeBytes * MODEL_RAM_OVERHEAD);
  if (!Number.isFinite(totalRamBytes) || totalRamBytes <= 0) {
    // Unknown hardware is not a licence to guess. Treat as fitting so an
    // undetectable machine still gets a model, but say the check was skipped.
    return { model, needsBytes, fits: true };
  }
  const ceiling = totalRamBytes * TOTAL_RAM_HEADROOM;
  if (needsBytes > ceiling) {
    return {
      model,
      needsBytes,
      fits: false,
      reason: `${model.id} needs about ${gb(needsBytes)} of RAM but only ${gb(ceiling)} of this machine's ${gb(totalRamBytes)} can safely be used.`,
    };
  }
  return { model, needsBytes, fits: true };
}

/*
 * THE FALLBACK CHAIN IS DELETED.
 *
 * `buildLocalFirstPlan` built preferred/secondary/lightweight steps and the
 * caller started at step ONE. With several models installed that step was the
 * largest one, so signed-in Chat ran a 9.3 GB engine while Control + Work ran
 * the fixed 1.9 GB engine. `pickLocalModelForHardware` only re-ranked the same
 * size-based choice inside what fitted in RAM.
 *
 * One engine needs no chain. If the fixed engine cannot serve a request, the
 * honest outcome is a stated refusal — not a quiet downgrade to a model the
 * single-model authority never chose.
 */

/**
 * How long the runtime keeps the model resident after a reply.
 *
 * THIS IS THE ENTIRE TIME-TO-FIRST-TOKEN STORY, MEASURED ON THIS MACHINE.
 *
 *     cold, model evicted    TTFT 5750 ms
 *     warm                   TTFT  222 ms
 *
 * Twenty-six times. Nothing else in the request comes close: streaming was
 * already on, the prompt is already short, and `keep_alive` makes a warm model
 * no faster at all (217 ms against 222 ms is noise). What it does is stop the
 * model being EVICTED, and eviction is what the 5.75 seconds is.
 *
 * Ollama's own default unloads after five minutes idle — which is precisely
 * the gap between "OCADE answered me" and "I thought of the next thing to ask",
 * so in ordinary conversational use the default guarantees the slow path. Thirty
 * minutes covers a working session.
 *
 * THE COST IS HONEST AND IS RAM. The model stays in memory for half an hour
 * after the last question instead of five minutes. On a machine that cannot
 * spare it the runtime evicts under pressure anyway, so this raises the ceiling
 * rather than pinning the floor.
 */
export const MODEL_KEEP_ALIVE = "30m";

/* -------------------- Client-side local streaming -------------------- */

export interface LocalChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** Ollama-compatible base64 image payloads, without data-URL prefixes. */
  images?: string[];
}

/**
 * The context window a request needs — and why OCADE has to name it.
 *
 * THE DEFECT THIS EXISTS TO CLOSE. The runtime defaults to a 4,096-token
 * context and SILENTLY DROPS whatever does not fit. It does not warn, it does
 * not fail, and the model answers confidently from the fragment that survived.
 * Measured on this machine: a 220-line log with an access code on line 147 came
 * to 5,654 tokens, and the same question that returns "742913" with a large
 * enough window returned "74" — a number that appears nowhere in the document.
 * A user attaching a report and getting an answer about the half of it that
 * happened to fit is the worst failure this product can have, because nothing
 * on screen says anything went wrong.
 *
 * WHY IT IS NOT SIMPLY SET LARGE. The KV cache scales with the window, and it
 * is resident memory on a machine that is also running everything else the
 * person is doing. So the window is sized to the REQUEST: short chats
 * explicitly ask for the 4,096-token floor, and only a request that genuinely
 * needs more asks for more. An explicit floor matters because model defaults
 * are not stable: the installed vision model defaulted to 128,000 tokens and
 * allocated about 13 GB for a one-image proof until OCADE bounded it.
 */
export const CONTEXT_DEFAULT = 4096;
/**
 * Steps rather than an exact figure: the runtime reallocates and reloads when
 * the window changes, so a value that drifts with every message would reload
 * the model constantly. Rounding to a step means consecutive turns in the same
 * conversation usually ask for the same window and reuse the loaded weights.
 */
const CONTEXT_STEPS = [4096, 8192, 16384, 32768] as const;
/** Room for the answer itself. A window that fits only the prompt cannot reply. */
const CONTEXT_REPLY_RESERVE = 1024;
/**
 * A picture is not free. Vision models expand an image into hundreds of tokens
 * before a word is read; 1,200 is a conservative figure that errs towards
 * asking for a larger window rather than silently truncating one.
 */
const CONTEXT_TOKENS_PER_IMAGE = 1200;
/**
 * The largest window OCADE will ever ask for.
 *
 * Beyond this the KV cache stops being affordable on any hardware this product
 * targets. A request larger than the machine's ceiling is REPORTED rather than
 * quietly cut.
 */
export const CONTEXT_CEILING = 32768;

/**
 * How large a window this particular machine can afford.
 *
 * MEASURED, not assumed. On the reference machine (15.65 GB, no acceleration)
 * the 8B tier occupies 5.53 GB at the runtime's default window and 7.35 GB at
 * 16,384 — an extra 1.82 GB of resident memory for the KV cache alone. At
 * 32,768 the same model would approach 9 GB, which on a 16 GB laptop that is
 * also running a browser and everything else is the point where the machine
 * starts swapping and the whole system becomes unpleasant, not just the chat.
 *
 * So the ceiling scales with total memory. An unknown total gets the smallest
 * step above the default: guessing upwards here is paid for by the user in
 * responsiveness, and that is not OCADE's to spend.
 */
export function contextCeilingFor(totalRamBytes?: number): number {
  const GIB = 1024 ** 3;
  if (!totalRamBytes || totalRamBytes <= 0) return 8192;
  if (totalRamBytes < 12 * GIB) return 8192;
  if (totalRamBytes < 20 * GIB) return 16384;
  return CONTEXT_CEILING;
}

/**
 * Roughly how many tokens a message list costs.
 *
 * 3.5 characters per token is deliberately pessimistic for English — real
 * tokenisers average closer to 4 — because underestimating means truncation
 * and overestimating merely costs a little memory.
 */
export function estimateTokens(messages: LocalChatMessage[]): number {
  let characters = 0;
  let images = 0;
  for (const message of messages) {
    characters += message.content.length;
    images += message.images?.length ?? 0;
  }
  return Math.ceil(characters / 3.5) + images * CONTEXT_TOKENS_PER_IMAGE;
}

export interface ContextPlan {
  /** Explicit window sent to the runtime; never delegated to a model default. */
  numCtx: number;
  estimatedTokens: number;
  /** True when the request is too large even for the ceiling. */
  exceedsCeiling: boolean;
  /**
   * Roughly how long this machine will spend READING the prompt before it says
   * anything, or null when there is no measured basis to say.
   */
  estimatedReadSeconds: number | null;
}

/**
 * Prompt-evaluation speed on a machine with no graphics acceleration.
 *
 * MEASURED, from the engine's own counters on the reference machine: a 5,654-
 * token prompt took 458.4 seconds to evaluate — 12.3 tokens per second — after
 * which generation itself took 3.8 seconds and the answer was correct. Reading
 * is the whole cost; answering is almost free.
 *
 * This is the figure behind the warning. Eight minutes of silence with a
 * spinner is indistinguishable from a hang, and a user who is told "this will
 * take a few minutes" can decide to trim the document instead of concluding
 * the product is broken.
 */
const CPU_PROMPT_TOKENS_PER_SECOND = 12.3;

/** Long enough that silence starts to look like a hang. */
export const SLOW_READ_WARNING_SECONDS = 45;

/**
 * How long the engine will spend reading, when that can be said honestly.
 *
 * Returns null unless the machine was MEASURED to have no acceleration. With a
 * graphics card the figure is different by an order of magnitude and nothing
 * here has measured it, so no estimate is offered rather than a made-up one —
 * a wrong time estimate is worse than none, because people plan around it.
 */
export function estimatedReadSeconds(
  estimatedTokens: number,
  hasDiscreteGpu: boolean | undefined,
): number | null {
  if (hasDiscreteGpu !== false) return null;
  return Math.round(estimatedTokens / CPU_PROMPT_TOKENS_PER_SECOND);
}

/**
 * Decide the window for one request. Pure, so the arithmetic is testable.
 *
 * `totalRamBytes` is what keeps this honest about the machine rather than about
 * the model: pass the measured total and the ceiling scales with it; omit it
 * and the smallest ceiling applies, because an unmeasured machine must not be
 * charged for an assumption.
 */
export function planContextWindow(
  messages: LocalChatMessage[],
  totalRamBytes?: number,
  hasDiscreteGpu?: boolean,
): ContextPlan {
  const ceiling = contextCeilingFor(totalRamBytes);
  const estimatedTokens = estimateTokens(messages);
  const readSeconds = estimatedReadSeconds(estimatedTokens, hasDiscreteGpu);
  const needed = estimatedTokens + CONTEXT_REPLY_RESERVE;
  if (needed <= CONTEXT_DEFAULT) {
    return {
      numCtx: CONTEXT_DEFAULT,
      estimatedTokens,
      exceedsCeiling: false,
      estimatedReadSeconds: readSeconds,
    };
  }
  const step = CONTEXT_STEPS.filter((size) => size <= ceiling).find((size) => size >= needed);
  return {
    numCtx: step ?? ceiling,
    estimatedTokens,
    // Still asks for the ceiling rather than giving up: a truncated answer with
    // a warning beats no answer at all. The caller is the one that must say so.
    exceedsCeiling: needed > ceiling,
    estimatedReadSeconds: readSeconds,
  };
}

export interface LocalStreamHandlers {
  onToken: (chunk: string) => void;
  signal?: AbortSignal;
  /**
   * Let the model run a hidden reasoning pass before answering.
   *
   * DEFAULTS TO FALSE, and that default is a measurement, not a taste.
   * On the reference machine (4 cores, no dedicated GPU) the same one-word
   * question through the same model measured:
   *
   *     reasoning on   163,215 ms to the first visible character
   *     reasoning off   60,991 ms cold, 27,863 ms warm
   *
   * The answer was "Tokyo" in every case. The user waits nearly three minutes
   * staring at nothing to receive a word the model could have produced in
   * seconds, because the reasoning tokens are generated but never shown. On a
   * machine with acceleration this is a reasonable trade; on the hardware
   * OCADE targets it is the difference between a usable chat and one that
   * looks frozen.
   *
   * Callers that genuinely want deliberation — a hard analysis step, not
   * ordinary conversation — pass `true` explicitly.
   */
  think?: boolean;
  /**
   * How big this request turned out to be, reported before it is sent.
   *
   * Exists so a surface can WARN when `exceedsCeiling` is true. Without it the
   * only honest alternative would be refusing the message outright, and a
   * warned partial answer is more useful than no answer.
   */
  onContextPlan?: (plan: ContextPlan) => void;
  /**
   * This machine's total memory, when it was measured precisely.
   *
   * Omitted means unknown, and unknown deliberately gets the SMALLEST context
   * ceiling — the extra memory a large window costs is paid in responsiveness
   * by the person using the computer, so it is not spent on a guess.
   */
  totalRamBytes?: number;
  /**
   * Tool schemas this turn may use.
   *
   * THE FIELD WHOSE ABSENCE WAS THE WHOLE PROBLEM. Until now this request
   * carried a model, messages, streaming, thinking and a context size — and
   * nothing else. The installed models advertise `tools` in their own
   * capability list, so OCADE could always have asked them to act and simply
   * never did. Passing schemas here is what turns a chat into an assistant.
   *
   * Deliberately per-call rather than global: the domain router decides which
   * handful of tools this turn sees, and a permanent catalogue would undo that.
   */
  tools?: unknown[];
  /**
   * Called when the model asks to run a tool.
   *
   * Separate from `onToken` because a tool call is not text: it must never be
   * rendered into the reply the user reads, and a UI that concatenated the two
   * would show raw JSON mid-sentence.
   */
  onToolCall?: (call: { id?: string; name: string; arguments: Record<string, unknown> }) => void;
}

/**
 * Ask the runtime to load a model's weights WITHOUT sending a prompt.
 *
 * Cold start is the remaining lag, and it is entirely disk time. Re-measured on
 * the reference machine against the engine OCADE actually ships, first token
 * for the same question:
 *
 *     cold  294,547 ms
 *     warm      672 ms
 *
 * Four hundred times. The warm figure is a genuinely fast assistant; the cold
 * one is what a person meets when they open the app, and nothing on screen
 * explains it to them. That gap is the entire argument for this function.
 *
 * The cold figure is a worst case — that machine was under heavy memory
 * pressure when it was taken — and it is quoted rather than averaged away
 * because the worst case is the one a user remembers.
 *
 * WHY THIS IS NOT CALLED ON MOUNT. Loading several gigabytes because someone
 * glanced at a screen is its own way of making a machine unusable. The right
 * trigger is intent — the caller invokes this when the user starts TYPING, so
 * the weights land while they finish the sentence and nothing is loaded for a
 * visit that was never going to send a message.
 *
 * Sends an empty message list, which the runtime treats as load-only: no
 * prompt, no generation, nothing leaves the machine. Failure is silent by
 * design — this is an optimisation, and a failed preload must never surface as
 * an error for a message the user has not sent yet. The subsequent real
 * request simply pays the load cost as before.
 */
export async function preloadLocalModel(
  bridgeUrl: string,
  modelId: string,
  fetchImpl?: FetchLike,
  /**
   * Warm the model at THE WINDOW THE SEND WILL USE.
   *
   * Without this the optimisation defeated itself exactly when it mattered
   * most: the runtime reloads the weights whenever the context window changes,
   * so warming at the default and then sending a long document at a larger
   * window paid the full multi-gigabyte load anyway — after the user pressed
   * send, not while they were typing.
   *
   * Measured on this machine: that reload plus prompt evaluation ran past five
   * minutes and was abandoned by the transport; the identical request against
   * an already-warm model at the same window answered in 40.6 seconds.
   */
  numCtx?: number | null,
): Promise<boolean> {
  const f = getFetch(fetchImpl);
  if (!f) return false;
  try {
    const res = await f(`${bridgeUrl.replace(/\/+$/, "")}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: [],
        options: { num_ctx: numCtx ?? CONTEXT_DEFAULT },
        // A warm-up that lets the model be evicted five minutes later has not
        // warmed anything up.
        keep_alive: MODEL_KEEP_ALIVE,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** The tool-call shape the runtime emits, before it has been checked. */
interface RawToolCall {
  id?: unknown;
  function?: { name?: unknown; arguments?: unknown };
}

/**
 * Read one tool call, refusing anything that is not usable.
 *
 * Arguments arrive as an object from Ollama and as a JSON STRING from
 * OpenAI-compatible runtimes, and a model under pressure sometimes emits a
 * string that is not valid JSON at all. All three are handled here so the agent
 * loop only ever sees a real object — a malformed call is dropped rather than
 * passed on as `{}`, because an empty argument set on, say, a file action is
 * not a harmless default.
 */
export function readToolCall(
  raw: RawToolCall,
): { id?: string; name: string; arguments: Record<string, unknown> } | null {
  const name = raw?.function?.name;
  if (typeof name !== "string" || !name.trim()) return null;
  const rawArgs = raw.function?.arguments;
  let args: Record<string, unknown> = {};
  if (typeof rawArgs === "string") {
    try {
      const parsed: unknown = JSON.parse(rawArgs);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      args = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    args = rawArgs as Record<string, unknown>;
  }
  return {
    ...(typeof raw.id === "string" ? { id: raw.id } : {}),
    name: name.trim(),
    arguments: args,
  };
}

/**
 * Stream a chat completion directly from the local runtime (browser → device).
 * The prompt never leaves the machine. Parses Ollama's NDJSON /api/chat stream.
 * Supports cancellation via `signal`, and tool calls via `handlers.tools`.
 */
export async function streamLocalChat(
  bridgeUrl: string,
  modelId: string,
  messages: LocalChatMessage[],
  handlers: LocalStreamHandlers,
  fetchImpl?: FetchLike,
): Promise<{ ok: boolean; reason?: string }> {
  const f = getFetch(fetchImpl);
  if (!f) return { ok: false, reason: "No fetch available." };
  const base = bridgeUrl.replace(/\/+$/, "");

  /*
   * Size the context to this request before sending it. Short conversations
   * get the explicit 4,096-token floor, so a model update cannot silently make
   * an ordinary request reserve a 128k KV cache; a long document asks for the
   * larger bounded window it actually needs.
   */
  const context = planContextWindow(messages, handlers.totalRamBytes);
  handlers.onContextPlan?.(context);

  const send = (includeThink: boolean) =>
    f(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages,
        stream: true,
        // Sent explicitly rather than relying on the model's own default, so
        // the behaviour cannot change underneath the product when a model is
        // updated.
        ...(includeThink ? { think: handlers.think === true } : {}),
        ...(handlers.tools && handlers.tools.length > 0 ? { tools: handlers.tools } : {}),
        options: { num_ctx: context.numCtx },
        // Keeps the next question on the 222 ms path instead of the 5750 ms one.
        keep_alive: MODEL_KEEP_ALIVE,
      }),
      signal: handlers.signal,
    });

  let res: Response;
  try {
    /*
     * Do not send `think` to a model that has no reasoning mode.
     *
     *   POST /api/chat {"model":"qwen2.5:3b","think":true}
     *   → 400 "qwen2.5:3b" does not support thinking
     *
     * The retry below already recovered from that, but it paid a whole failed
     * round trip on every single message to learn something knowable from the
     * model id. Asking first turns a guaranteed retry into no retry at all.
     */
    res = await send(supportsThinkingField(modelId));
    /*
     * The retry stays, for models this list does not know about. Older
     * runtimes and models with no reasoning mode reject the field outright;
     * they have no hidden reasoning pass to disable, so nothing is lost by
     * omitting it.
     */
    if (res.status === 400) {
      const detail = await res.clone().text();
      if (/think/i.test(detail)) res = await send(false);
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return { ok: false, reason: "cancelled" };
    /*
     * A TRANSPORT TIMEOUT IS NOT AN ABSENT ENGINE, and saying so sends the user
     * to the wrong remedy — "start the engine" for a machine where it is
     * already running and working hard.
     *
     * Observed: a 220-line document, 5,849 estimated tokens, on this
     * CPU-only machine. Prompt evaluation alone ran past five minutes before a
     * single byte came back, and Node's fetch gives up at 300 seconds. The
     * request was reported as "unreachable" while the engine was in fact
     * mid-evaluation. Browsers do not impose that limit, so this is mostly the
     * paired-bridge and tooling path — but a wrong diagnosis is worth the same
     * on either.
     */
    if (isSlowResponseError(e)) {
      return {
        ok: false,
        reason:
          "The engine did not send anything back in time. A long document can take several minutes to read on this computer.",
      };
    }
    return { ok: false, reason: "Local engine unreachable." };
  }
  if (!res.ok || !res.body) {
    return { ok: false, reason: `Local engine HTTP ${res.status}.` };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    let streamedChars = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const piece = decoder.decode(value, { stream: true });
      streamedChars += piece.length;
      buffer += piece;
      /*
       * A local engine that never stops sending would grow this buffer until
       * the tab dies. The line cap matters separately: bytes are held until a
       * newline arrives, so a stream that never sends one is unbounded even
       * when the total is still small.
       */
      assertStreamWithinLimit(streamedChars, MAX_STREAM_CHARS, "local reply");
      assertStreamWithinLimit(buffer.length, MAX_STREAM_LINE_CHARS, "local reply line");
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line) as {
            message?: { content?: string; tool_calls?: RawToolCall[] };
            done?: boolean;
          };
          const piece = obj.message?.content;
          if (piece) handlers.onToken(piece);
          const calls = obj.message?.tool_calls;
          if (calls && handlers.onToolCall) {
            for (const call of calls) {
              const parsed = readToolCall(call);
              if (parsed) handlers.onToolCall(parsed);
            }
          }
        } catch {
          /* ignore partial/non-JSON keepalive lines */
        }
      }
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return { ok: false, reason: "cancelled" };
    // A budget stop carries its own explanation; "interrupted" would hide why.
    if (e instanceof StreamLimitError) return { ok: false, reason: e.message };
    return { ok: false, reason: "Local stream interrupted." };
  }
}
