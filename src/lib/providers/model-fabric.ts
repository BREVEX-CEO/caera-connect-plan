/**
 * OCADE local model fabric.
 *
 * Every provider URL accepted by this module must be loopback or a private-LAN
 * address. Public internet AI endpoints are structurally rejected. Some local
 * runtimes expose an OpenAI-compatible HTTP shape; that is a wire protocol,
 * not an OpenAI/cloud provider, and the URL validator keeps it local.
 */
import type { OcadeBrain } from "../skills/action-contract";

export type ModelProviderId =
  | "ollama"
  | "lm_studio"
  | "llama_cpp"
  | "localai"
  | "vllm"
  | "jan"
  | "koboldcpp"
  | "local_compatible";
export type ProviderPrivacyClass = "on_device" | "private_network";
export type ProviderCostClass = "free_local";
export type ProviderAuthMethod = "none" | "optional_bearer";
export type CircuitState = "closed" | "open" | "half_open";
export type ProviderHealth = "unknown" | "healthy" | "unhealthy" | "rate_limited";

export interface ModelCapabilities {
  contextTokens: number;
  structuredOutput: boolean;
  toolUse: boolean;
  vision: boolean;
  coding: boolean;
  embedding: boolean;
  expectedRamMb: number;
  expectedGpuMemoryMb: number;
}
export interface ProviderModel {
  providerId: ModelProviderId;
  id: string;
  displayName: string;
  capabilities: ModelCapabilities;
}
export interface ProviderManifest {
  id: ModelProviderId;
  displayName: string;
  baseUrl: string;
  authentication: { method: ProviderAuthMethod; credentialRef: string | null };
  discovery: "ollama_tags" | "compatible_models" | "kobold_model";
  chatProtocol: "ollama_chat" | "compatible_chat";
  privacyClass: ProviderPrivacyClass;
  costClass: ProviderCostClass;
  priority: number;
  userEnabled: boolean;
  defaultCapabilities: ModelCapabilities;
}
export interface ProviderRuntimeState {
  health: ProviderHealth;
  latencyMs: number | null;
  rateLimitUntil: number | null;
  circuitState: CircuitState;
  circuitOpenUntil: number | null;
  consecutiveFailures: number;
  lastSuccessfulRequest: string | null;
  lastFailure: string | null;
  models: ProviderModel[];
}
export interface ProviderSnapshot extends ProviderManifest, ProviderRuntimeState {}
export interface ModelRequirement {
  contextTokens: number;
  structuredOutput?: boolean;
  toolUse?: boolean;
  vision?: boolean;
  coding?: boolean;
  embedding?: boolean;
  maxLatencyMs?: number;
  availableRamMb: number;
  availableGpuMemoryMb: number;
  /** `allow_cloud` is accepted only as a legacy serialized value; it never permits a public URL. */
  privacy: "local_only" | "allow_private_network" | "allow_cloud";
  /** Legacy compatibility field; there are no metered providers in this fabric. */
  allowMetered: boolean;
}
export interface FabricChatRequest {
  requirement: ModelRequirement;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}
export interface FabricAttempt {
  providerId: ModelProviderId;
  modelId: string;
  outcome: "succeeded" | "timeout" | "malformed" | "rate_limit" | "context_overflow" | "out_of_memory" | "unhealthy";
  evidence: string;
}
export type FabricChatOutcome =
  | { ok: true; content: string; providerId: ModelProviderId; modelId: string; attempts: FabricAttempt[]; evidence: string }
  | { ok: false; reason: string; attempts: FabricAttempt[]; remediation: "split_task" | "deterministic_tool" | "reduce_output" | "missing_capability" };
export type CredentialResolver = (credentialRef: string) => Promise<string | null>;
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const MAX_MESSAGES = 200;
const MAX_MESSAGE_LENGTH = 200_000;
const MAX_OUTPUT_TOKENS = 32_768;
const CIRCUIT_COOLDOWN_MS = 30_000;

const baseline: ModelCapabilities = {
  contextTokens: 32_768,
  structuredOutput: false,
  toolUse: false,
  vision: false,
  coding: false,
  embedding: false,
  expectedRamMb: 8_192,
  expectedGpuMemoryMb: 4_096,
};
const cap = (over: Partial<ModelCapabilities> = {}): ModelCapabilities => ({ ...baseline, ...over });

export function createDefaultProviderManifests(): ProviderManifest[] {
  const compatible = (
    id: ModelProviderId,
    displayName: string,
    baseUrl: string,
    priority: number,
    credentialRef: string | null = null,
  ): ProviderManifest => ({
    id,
    displayName,
    baseUrl,
    authentication: credentialRef
      ? { method: "optional_bearer", credentialRef }
      : { method: "none", credentialRef: null },
    discovery: "compatible_models",
    chatProtocol: "compatible_chat",
    privacyClass: "on_device",
    costClass: "free_local",
    priority,
    userEnabled: false,
    defaultCapabilities: cap(),
  });
  return [
    {
      id: "ollama",
      displayName: "OCADE local runtime",
      baseUrl: "http://localhost:11434",
      authentication: { method: "none", credentialRef: null },
      discovery: "ollama_tags",
      chatProtocol: "ollama_chat",
      privacyClass: "on_device",
      costClass: "free_local",
      priority: 10,
      userEnabled: true,
      defaultCapabilities: cap({ structuredOutput: true }),
    },
    compatible("lm_studio", "LM Studio (local)", "http://localhost:1234", 20),
    compatible("llama_cpp", "llama.cpp server (local)", "http://localhost:8080", 30),
    compatible("localai", "LocalAI", "http://localhost:8080", 40, "localai_token"),
    compatible("vllm", "vLLM (local)", "http://localhost:8000", 50, "vllm_token"),
    compatible("jan", "Jan local API", "http://localhost:1337", 60, "jan_token"),
    {
      ...compatible("koboldcpp", "KoboldCpp (local)", "http://localhost:5001", 70),
      discovery: "kobold_model",
    },
    compatible("local_compatible", "Generic local compatible endpoint", "http://localhost:8001", 80, "local_endpoint_token"),
  ].map((manifest) => ({
    ...manifest,
    authentication: { ...manifest.authentication },
    defaultCapabilities: { ...manifest.defaultCapabilities },
  }));
}

export const REQUIRED_MODEL_PROVIDER_IDS: ModelProviderId[] = [
  "ollama", "lm_studio", "llama_cpp", "localai", "vllm", "jan", "koboldcpp", "local_compatible",
];

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

/** Public AI endpoints are rejected regardless of user settings. */
export function validateProviderBaseUrl(baseUrl: string, _privacyClass: ProviderPrivacyClass): string | null {
  let url: URL;
  try { url = new URL(baseUrl); } catch { return "Provider base URL is invalid."; }
  if (url.username || url.password || url.search || url.hash) return "Provider URLs cannot contain credentials, query strings or fragments.";
  if (url.protocol !== "http:" && url.protocol !== "https:") return "Local providers require HTTP or HTTPS.";
  if (!LOCAL_HOSTS.has(url.hostname) && !isPrivateIpv4(url.hostname)) {
    return "OCADE local model providers must use loopback or a private-network address; public AI endpoints are forbidden.";
  }
  return null;
}

function emptyRuntimeState(): ProviderRuntimeState {
  return { health: "unknown", latencyMs: null, rateLimitUntil: null, circuitState: "closed", circuitOpenUntil: null, consecutiveFailures: 0, lastSuccessfulRequest: null, lastFailure: null, models: [] };
}
function bounded(value: unknown): string | null {
  return typeof value === "string" && value.trim() && value.length <= 500 ? value : null;
}
function inferCapabilities(provider: ProviderManifest, modelId: string, source: Record<string, unknown>): ModelCapabilities {
  const declared = Array.isArray(source.capabilities) ? source.capabilities.filter((x): x is string => typeof x === "string") : [];
  const has = (r: RegExp) => declared.some((x) => r.test(x));
  const lower = modelId.toLowerCase();
  const context = Number(source.context_length ?? source.max_model_len ?? source.context_window) || provider.defaultCapabilities.contextTokens;
  const size = Number(source.size);
  return {
    ...provider.defaultCapabilities,
    contextTokens: Number.isFinite(context) && context > 0 ? Math.min(context, 10_000_000) : 32_768,
    structuredOutput: provider.defaultCapabilities.structuredOutput || has(/structured|json/i),
    toolUse: provider.defaultCapabilities.toolUse || has(/tool|function/i),
    vision: provider.defaultCapabilities.vision || has(/vision|image|multimodal/i) || /(vision|llava|vl\b|moondream)/i.test(lower),
    coding: provider.defaultCapabilities.coding || has(/code|programming/i) || /(code|coder|starcoder)/i.test(lower),
    embedding: provider.defaultCapabilities.embedding || has(/embed/i) || /(embed|bge-|e5-)/i.test(lower),
    expectedRamMb: Number.isFinite(size) && size > 0 ? Math.ceil((size / 1048576) * 1.25) : provider.defaultCapabilities.expectedRamMb,
  };
}
function modelFrom(provider: ProviderManifest, value: unknown): ProviderModel | null {
  const row = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const id = bounded(typeof value === "string" ? value : row.id ?? row.name ?? row.model);
  return id ? { providerId: provider.id, id, displayName: bounded(row.display_name ?? row.name ?? row.id) ?? id, capabilities: inferCapabilities(provider, id, row) } : null;
}
function parseModels(provider: ProviderManifest, body: unknown): ProviderModel[] {
  let rows: unknown[] = [];
  if (provider.discovery === "ollama_tags" && body && typeof body === "object") rows = (body as { models?: unknown[] }).models ?? [];
  else if (provider.discovery === "kobold_model" && body && typeof body === "object") {
    const one = (body as { result?: unknown; model?: unknown }).result ?? (body as { model?: unknown }).model;
    if (one !== undefined) rows = [one];
  } else if (body && typeof body === "object") rows = (body as { data?: unknown[] }).data ?? [];
  return rows.slice(0, 500).map((row) => modelFrom(provider, row)).filter((row): row is ProviderModel => row !== null);
}
function endpoint(provider: ProviderManifest, kind: "discover" | "chat") {
  const root = provider.baseUrl.replace(/\/+$/, "");
  if (kind === "chat") return provider.chatProtocol === "ollama_chat" ? `${root}/api/chat` : `${root}/v1/chat/completions`;
  if (provider.discovery === "ollama_tags") return `${root}/api/tags`;
  if (provider.discovery === "kobold_model") return `${root}/api/v1/model`;
  return `${root}/v1/models`;
}
function stateReason(error: unknown) { return (error instanceof Error ? error.message : String(error)).slice(0, 500); }
function supports(model: ProviderModel, req: ModelRequirement) {
  const c = model.capabilities;
  return c.contextTokens >= req.contextTokens && (!req.structuredOutput || c.structuredOutput) && (!req.toolUse || c.toolUse) && (!req.vision || c.vision) && (!req.coding || c.coding) && (!req.embedding || c.embedding) && c.expectedRamMb <= req.availableRamMb && c.expectedGpuMemoryMb <= req.availableGpuMemoryMb;
}
async function json(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new Error("Local provider returned malformed JSON."); }
}

export class ModelProviderFabric {
  private readonly manifests = new Map<ModelProviderId, ProviderManifest>();
  private readonly runtime = new Map<ModelProviderId, ProviderRuntimeState>();

  constructor(
    manifests: ProviderManifest[] = createDefaultProviderManifests(),
    private readonly fetchImpl: FetchLike = fetch,
    private readonly credentials: CredentialResolver = async () => null,
    private readonly now: () => number = Date.now,
  ) {
    for (const manifest of manifests) {
      const issue = validateProviderBaseUrl(manifest.baseUrl, manifest.privacyClass);
      if (issue) throw new Error(`${manifest.id}: ${issue}`);
      this.manifests.set(manifest.id, { ...manifest, authentication: { ...manifest.authentication }, defaultCapabilities: { ...manifest.defaultCapabilities } });
      this.runtime.set(manifest.id, emptyRuntimeState());
    }
  }

  configure(providerId: ModelProviderId, patch: { baseUrl?: string; userEnabled?: boolean; priority?: number }): void {
    const current = this.manifests.get(providerId);
    if (!current) throw new Error("Unknown provider.");
    const next = { ...current, ...patch };
    const issue = validateProviderBaseUrl(next.baseUrl, next.privacyClass);
    if (issue) throw new Error(issue);
    this.manifests.set(providerId, next);
    this.runtime.set(providerId, emptyRuntimeState());
  }

  snapshots(): ProviderSnapshot[] {
    return [...this.manifests.values()].map((manifest) => ({ ...manifest, ...this.runtime.get(manifest.id)!, models: this.runtime.get(manifest.id)!.models.map((model) => ({ ...model, capabilities: { ...model.capabilities } })) })).sort((a, b) => a.priority - b.priority);
  }

  private async headers(provider: ProviderManifest) {
    const headers: Record<string, string> = { accept: "application/json" };
    const ref = provider.authentication.credentialRef;
    const secret = ref ? await this.credentials(ref) : null;
    if (secret) headers.authorization = `Bearer ${secret}`;
    return headers;
  }

  async discover(providerId: ModelProviderId, timeoutMs = 4_000): Promise<ProviderSnapshot> {
    const provider = this.manifests.get(providerId);
    if (!provider) throw new Error("Unknown provider.");
    const state = this.runtime.get(providerId)!;
    if (!provider.userEnabled) return this.snapshots().find((row) => row.id === providerId)!;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = this.now();
    try {
      const response = await this.fetchImpl(endpoint(provider, "discover"), { headers: await this.headers(provider), signal: controller.signal });
      if (!response.ok) throw new Error(`Local provider discovery HTTP ${response.status}.`);
      const models = parseModels(provider, await json(response));
      if (!models.length) throw new Error("Local provider returned no usable models.");
      Object.assign(state, { health: "healthy", latencyMs: Math.max(0, this.now() - started), circuitState: "closed", circuitOpenUntil: null, consecutiveFailures: 0, lastSuccessfulRequest: new Date(this.now()).toISOString(), lastFailure: null, models });
    } catch (error) {
      Object.assign(state, { health: "unhealthy", circuitState: "open", circuitOpenUntil: this.now() + CIRCUIT_COOLDOWN_MS, consecutiveFailures: state.consecutiveFailures + 1, lastFailure: stateReason(error), models: [] });
    } finally { clearTimeout(timer); }
    return this.snapshots().find((row) => row.id === providerId)!;
  }

  async discoverEnabled(timeoutMs = 4_000): Promise<ProviderSnapshot[]> {
    await Promise.all([...this.manifests.values()].filter((p) => p.userEnabled).map((p) => this.discover(p.id, timeoutMs)));
    return this.snapshots();
  }

  route(requirement: ModelRequirement): ProviderModel[] {
    return this.snapshots()
      .filter((provider) => provider.userEnabled && provider.health === "healthy" && (!provider.circuitOpenUntil || provider.circuitOpenUntil <= this.now()))
      .filter((provider) => requirement.privacy !== "local_only" || provider.privacyClass === "on_device")
      .flatMap((provider) => provider.models.filter((model) => supports(model, requirement)))
      .sort((a, b) => a.capabilities.expectedRamMb - b.capabilities.expectedRamMb);
  }

  async chat(request: FabricChatRequest): Promise<FabricChatOutcome> {
    if (!request.messages.length || request.messages.length > MAX_MESSAGES || request.messages.some((m) => typeof m.content !== "string" || m.content.length > MAX_MESSAGE_LENGTH) || (request.maxOutputTokens !== undefined && (request.maxOutputTokens < 1 || request.maxOutputTokens > MAX_OUTPUT_TOKENS))) {
      return { ok: false, reason: "The local model request is malformed or outside bounded limits.", attempts: [], remediation: "reduce_output" };
    }
    const candidates = this.route(request.requirement);
    if (!candidates.length) return { ok: false, reason: "No enabled healthy local model satisfies the request.", attempts: [], remediation: request.requirement.contextTokens > 32_768 ? "split_task" : "missing_capability" };
    const attempts: FabricAttempt[] = [];
    for (const model of candidates) {
      const provider = this.manifests.get(model.providerId)!;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? 30_000);
      const parentAbort = () => controller.abort();
      request.signal?.addEventListener("abort", parentAbort, { once: true });
      try {
        const body = provider.chatProtocol === "ollama_chat"
          ? { model: model.id, messages: request.messages, stream: false, options: { temperature: request.temperature, num_predict: request.maxOutputTokens } }
          : { model: model.id, messages: request.messages, stream: false, temperature: request.temperature, max_tokens: request.maxOutputTokens };
        const response = await this.fetchImpl(endpoint(provider, "chat"), { method: "POST", headers: { ...(await this.headers(provider)), "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
        if (!response.ok) throw new Error(`Local provider HTTP ${response.status}.`);
        const parsed = (await json(response)) as { message?: { content?: unknown }; choices?: Array<{ message?: { content?: unknown } }> };
        const message = provider.chatProtocol === "ollama_chat" ? parsed.message : parsed.choices?.[0]?.message;
        const content = typeof message?.content === "string" ? message.content : null;
        if (!content) throw new Error("Local provider returned malformed completion content.");
        attempts.push({ providerId: provider.id, modelId: model.id, outcome: "succeeded", evidence: "Local/private-network provider returned bounded completion content." });
        return { ok: true, content, providerId: provider.id, modelId: model.id, attempts, evidence: "Selected an allowed local/private-network model. Public AI endpoints are not routable." };
      } catch (error) {
        attempts.push({ providerId: provider.id, modelId: model.id, outcome: /abort|timeout/i.test(stateReason(error)) ? "timeout" : "unhealthy", evidence: stateReason(error) });
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", parentAbort);
      }
    }
    return { ok: false, reason: `All ${attempts.length} local provider attempt(s) failed closed.`, attempts, remediation: "deterministic_tool" };
  }
}

export function createModelFabricBrain(fabric: ModelProviderFabric, requirement: ModelRequirement): OcadeBrain {
  return {
    async propose(goal, signal) {
      const result = await fabric.chat({ requirement: { ...requirement, structuredOutput: true }, messages: [{ role: "system", content: "Return one bounded OCADE BrainProposal JSON object. Do not execute tools." }, { role: "user", content: goal }], maxOutputTokens: 8192, signal });
      if (!result.ok) throw new Error(result.reason);
      try { return JSON.parse(result.content); } catch { throw new Error("The local model returned malformed plan JSON."); }
    },
  };
}
