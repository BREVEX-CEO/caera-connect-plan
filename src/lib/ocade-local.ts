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
// Value imports only; `tier-policy` depends on nothing in this module, so there
// is no cycle. Shared deliberately — a second copy of "which tiers need a GPU"
// is how the router and the tier policy came to disagree about one machine.
import { GPU_REQUIRED_TAGS, QUARANTINED_TAGS } from "./local/tier-policy";

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

/**
 * Choose the best installed local model for a desired capability. Prefers an
 * exact profile match; a general chat request may be served by any model
 * (code models are still capable chatters); "fast" prefers the smallest.
 * Returns null when nothing suitable is installed.
 */
export function pickLocalModel(
  models: LocalModelInfo[],
  desired: OcadeLocalProfile,
): LocalModelInfo | null {
  if (models.length === 0) return null;
  const exact = models.filter((m) => m.profile === desired);
  const pool = exact.length > 0 ? exact : desired === "vision" ? [] : models;
  if (pool.length === 0) return null;
  if (desired === "fast") {
    return [...pool].sort((a, b) => a.sizeBytes - b.sizeBytes)[0];
  }
  // Prefer larger (more capable) for general/code/vision.
  return [...pool].sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
}

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

export interface HardwareAwarePick {
  picked: LocalModelInfo | null;
  /** Models rejected because this machine cannot hold them, with reasons. */
  excluded: ModelFit[];
  /** Set when nothing at all fits — the honest "use cloud or free RAM" case. */
  reason?: string;
}

/**
 * Choose a local model that this machine can actually run.
 *
 * `pickLocalModel` alone prefers the LARGEST model for general/code, which on a
 * 16 GB machine holding an 18.6 GB model returns something that cannot load.
 * This filters to what fits first, then applies the same preference within that
 * set, so "most capable" never means "most capable in theory".
 */
export function pickLocalModelForHardware(
  models: LocalModelInfo[],
  desired: OcadeLocalProfile,
  totalRamBytes: number,
): HardwareAwarePick {
  const fits = models.map((m) => modelFit(m, totalRamBytes));
  const runnable = fits.filter((f) => f.fits).map((f) => f.model);
  const excluded = fits.filter((f) => !f.fits);

  if (runnable.length === 0) {
    return {
      picked: null,
      excluded,
      reason:
        models.length === 0
          ? "No on-device models are installed yet."
          : `No installed model fits this machine's ${gb(totalRamBytes)} of RAM.`,
    };
  }
  return { picked: pickLocalModel(runnable, desired), excluded };
}

export type FallbackStepKind =
  | "local_preferred"
  | "local_secondary"
  | "local_lightweight"
  | "local_reduced"
  | "ask_cloud"
  | "fail";

export interface FallbackStep {
  kind: FallbackStepKind;
  label: OcadeCapabilityLabel | null;
  /** Raw model id for local steps — internal routing, not shown to users. */
  modelId: string | null;
  detail: string;
}

export interface FallbackPlanInput {
  desired: OcadeLocalProfile;
  models: LocalModelInfo[];
  /** Whether crossing to cloud is permitted at all (privacy/allowance). */
  cloudAllowed: boolean;
  online: boolean;
  /**
   * Total physical RAM, when known. Models that cannot be resident are dropped
   * from the chain rather than offered and then failing to load. Omit only when
   * hardware is genuinely undetectable; omitting it disables the check.
   */
  totalRamBytes?: number;
  /**
   * Whether this machine has real graphics acceleration.
   *
   * `false` drops tiers that need it. Omit when genuinely unknown — claiming
   * "no GPU" without evidence would shrink the chain on a guess.
   */
  hasDiscreteGpu?: boolean;
}

/**
 * Build the capability-aware fallback chain (decision #17):
 * preferred local → secondary local → lightweight local → reduced local →
 * ask for OCADE Cloud → clear failure.
 * Pure and deterministic.
 */
export function buildLocalFirstPlan(input: FallbackPlanInput): FallbackStep[] {
  const steps: FallbackStep[] = [];
  const { desired } = input;

  /*
   * Filter to what this machine can hold BEFORE building the chain. Offering a
   * model that cannot load is worse than offering nothing: every step below
   * would inherit the same impossible candidate, and the user would watch the
   * chain fail all the way down to `fail` for a reason none of the steps state.
   */
  const excludedByHardware =
    input.totalRamBytes === undefined
      ? []
      : input.models.map((m) => modelFit(m, input.totalRamBytes!)).filter((f) => !f.fits);
  const excludedIds = new Set(excludedByHardware.map((f) => f.model.id));

  /*
   * Fitting in memory is not the same as being usable.
   *
   * `routeTask` already refuses a quarantined tier and a GPU-tier model on a
   * machine without acceleration; this chain did not, so the fallback path
   * could hand back exactly the model the primary path had just rejected — and
   * on the reference machine that model needed three minutes for a one-word
   * answer. The same two lists decide here, imported rather than copied.
   */
  const unusableIds = new Set(
    input.models
      .filter(
        (m) =>
          QUARANTINED_TAGS[m.id] !== undefined ||
          (GPU_REQUIRED_TAGS.has(m.id) && input.hasDiscreteGpu === false),
      )
      .map((m) => m.id),
  );

  const models = input.models.filter((m) => !excludedIds.has(m.id) && !unusableIds.has(m.id));

  const preferred = pickLocalModel(models, desired);
  if (preferred) {
    steps.push({
      kind: "local_preferred",
      label: preferred.label,
      modelId: preferred.id,
      detail: `Preferred on-device engine (${labelName(preferred.label)}).`,
    });
  }

  const secondary = models
    .filter((m) => m.id !== preferred?.id)
    .sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
  if (secondary) {
    steps.push({
      kind: "local_secondary",
      label: secondary.label,
      modelId: secondary.id,
      detail: "Secondary on-device engine.",
    });
  }

  const lightweight = [...models].sort((a, b) => a.sizeBytes - b.sizeBytes)[0];
  if (lightweight && lightweight.id !== preferred?.id && lightweight.id !== secondary?.id) {
    steps.push({
      kind: "local_lightweight",
      label: capabilityLabelFor({ locality: "local", profile: "fast" }),
      modelId: lightweight.id,
      detail: "Lightweight on-device engine for low resources.",
    });
  }

  if (models.length > 0) {
    steps.push({
      kind: "local_reduced",
      label: "OCADE Local",
      modelId: null,
      detail: "Reduced offline response from local capability only.",
    });
  }

  if (input.online && input.cloudAllowed) {
    steps.push({
      kind: "ask_cloud",
      label: "OCADE Cloud",
      modelId: null,
      detail: "Ask permission to use OCADE Cloud for this request.",
    });
  }

  if (steps.length === 0) {
    /*
     * Distinguish "nothing installed" from "everything installed is too big for
     * this machine". They are different problems with different fixes, and
     * telling a user with three installed models that none is installed is a
     * lie the hardware check has already disproved.
     */
    const tooBig = excludedByHardware.length > 0;
    steps.push({
      kind: "fail",
      label: null,
      modelId: null,
      detail: tooBig
        ? `${excludedByHardware.length} installed model${excludedByHardware.length === 1 ? "" : "s"} cannot run on this machine. ${excludedByHardware[0].reason}`
        : input.online
          ? "No local engine is installed and OCADE Cloud isn't permitted for this content."
          : "You're offline and no local engine is installed yet.",
    });
  }
  return steps;
}

function labelName(label: OcadeCapabilityLabel): string {
  return label;
}

/* -------------------- Client-side local streaming -------------------- */

export interface LocalChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** Ollama-compatible base64 image payloads, without data-URL prefixes. */
  images?: string[];
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
}

/**
 * Ask the runtime to load a model's weights WITHOUT sending a prompt.
 *
 * Cold start is the remaining lag, and it is entirely disk time. Measured on
 * the reference machine, first token for the same question:
 *
 *     qwen3:8b    cold 26,932 ms   warm 2,192 ms
 *     qwen3:1.7b  cold  8,975 ms   warm 6,144 ms
 *
 * The warm figure is a usable chat; the cold one is what a person meets when
 * they open the app, and it is twelve times worse for no reason they can see.
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
): Promise<boolean> {
  const f = getFetch(fetchImpl);
  if (!f) return false;
  try {
    const res = await f(`${bridgeUrl.replace(/\/+$/, "")}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: modelId, messages: [] }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Stream a chat completion directly from the local runtime (browser → device).
 * The prompt never leaves the machine. Parses Ollama's NDJSON /api/chat stream.
 * Supports cancellation via `signal`.
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
      }),
      signal: handlers.signal,
    });

  let res: Response;
  try {
    res = await send(true);
    /*
     * Older runtimes, and models with no reasoning mode at all, reject the
     * `think` field outright. Retrying without it keeps those models working
     * instead of making a latency optimisation a hard dependency — they have
     * no hidden reasoning pass to disable, so nothing is lost by omitting it.
     */
    if (res.status === 400) {
      const detail = await res.clone().text();
      if (/think/i.test(detail)) res = await send(false);
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return { ok: false, reason: "cancelled" };
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
          const obj = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
          const piece = obj.message?.content;
          if (piece) handlers.onToken(piece);
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
