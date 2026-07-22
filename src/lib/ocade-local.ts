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
  capabilityLabelFor,
  type OcadeCapabilityLabel,
  type OcadeLocalProfile,
} from "./ocade-capability-labels";

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

const VISION_HINT = /(llava|vision|-vl\b|minicpm-v|moondream|bakllava|llama3.2-vision)/i;
const CODE_HINT = /(coder|code|deepseek-coder|starcoder|codellama|codegemma)/i;

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
    VISION_HINT.test(id) || families.some((f) => /vision|clip|vit/i.test(f ?? ""));
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

/** Health + installed-model discovery against the local bridge. */
export async function discoverLocalModels(
  bridgeUrl: string = DEFAULT_LOCAL_BRIDGE_URL,
  fetchImpl?: FetchLike,
  timeoutMs = 4000,
): Promise<LocalDiscovery> {
  const f = getFetch(fetchImpl);
  if (!f) return { ok: false, reachable: false, models: [], reason: "No fetch available." };
  const base = bridgeUrl.replace(/\/+$/, "");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const vres = await f(`${base}/api/version`, { signal: ctrl.signal });
    if (!vres.ok) {
      return { ok: false, reachable: false, models: [], reason: `Bridge HTTP ${vres.status}.` };
    }
    const version = ((await vres.json()) as { version?: string }).version;
    const tres = await f(`${base}/api/tags`, { signal: ctrl.signal });
    if (!tres.ok) {
      return { ok: false, reachable: true, version, models: [], reason: `Model list HTTP ${tres.status}.` };
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
    const reason = e instanceof Error && e.name === "AbortError" ? "Local engine timed out." : "Local engine unreachable.";
    return { ok: false, reachable: false, models: [], reason };
  } finally {
    clearTimeout(t);
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
}

/**
 * Build the capability-aware fallback chain (decision #17):
 * preferred local → secondary local → lightweight local → reduced local →
 * ask for OCADE Cloud → clear failure.
 * Pure and deterministic.
 */
export function buildLocalFirstPlan(input: FallbackPlanInput): FallbackStep[] {
  const steps: FallbackStep[] = [];
  const { models, desired } = input;

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
    steps.push({
      kind: "fail",
      label: null,
      modelId: null,
      detail: input.online
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
}

export interface LocalStreamHandlers {
  onToken: (chunk: string) => void;
  signal?: AbortSignal;
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
  let res: Response;
  try {
    res = await f(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: modelId, messages, stream: true }),
      signal: handlers.signal,
    });
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
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
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
    return { ok: false, reason: "Local stream interrupted." };
  }
}
