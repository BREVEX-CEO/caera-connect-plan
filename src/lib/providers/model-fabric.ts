/**
 * OCADE multi-provider model fabric.
 *
 * Provider manifests are client-safe and never contain credentials. Secrets
 * are resolved only at request time, added to one outbound request, and never
 * copied into snapshots, errors, receipts, or persisted preferences.
 */
import type { OcadeBrain } from "../control/control-plane";

export type ModelProviderId =
  | "ollama"
  | "lm_studio"
  | "llama_cpp"
  | "localai"
  | "vllm"
  | "jan"
  | "koboldcpp"
  | "openai_compatible"
  | "openai";

export type ProviderPrivacyClass = "on_device" | "private_network" | "cloud";
export type ProviderCostClass = "free_local" | "metered";
export type ProviderAuthMethod = "none" | "optional_bearer" | "required_bearer";
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
  authentication: {
    method: ProviderAuthMethod;
    credentialRef: string | null;
  };
  discovery: "ollama_tags" | "openai_models" | "kobold_model";
  chatProtocol: "ollama_chat" | "openai_chat";
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
  privacy: "local_only" | "allow_private_network" | "allow_cloud";
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
  outcome:
    | "succeeded"
    | "timeout"
    | "malformed"
    | "rate_limit"
    | "context_overflow"
    | "out_of_memory"
    | "unhealthy";
  evidence: string;
}

export type FabricChatOutcome =
  | {
      ok: true;
      content: string;
      providerId: ModelProviderId;
      modelId: string;
      attempts: FabricAttempt[];
      evidence: string;
    }
  | {
      ok: false;
      reason: string;
      attempts: FabricAttempt[];
      remediation: "split_task" | "deterministic_tool" | "reduce_output" | "missing_capability";
    };

export type CredentialResolver = (credentialRef: string) => Promise<string | null>;
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const CIRCUIT_COOLDOWN_MS = 30_000;
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const MAX_DISCOVERED_MODELS = 500;
const MAX_MESSAGES = 200;
const MAX_MESSAGE_LENGTH = 200_000;
const MAX_OUTPUT_TOKENS = 32_768;

const generalLocal: ModelCapabilities = {
  contextTokens: 32_768,
  structuredOutput: false,
  toolUse: false,
  vision: false,
  coding: false,
  embedding: false,
  expectedRamMb: 8_192,
  expectedGpuMemoryMb: 4_096,
};

function capabilities(over: Partial<ModelCapabilities> = {}): ModelCapabilities {
  return { ...generalLocal, ...over };
}

/** Fresh copies prevent runtime configuration from mutating global metadata. */
export function createDefaultProviderManifests(): ProviderManifest[] {
  const manifests: ProviderManifest[] = [
    {
      id: "ollama",
      displayName: "Ollama",
      baseUrl: "http://localhost:11434",
      authentication: { method: "none", credentialRef: null },
      discovery: "ollama_tags",
      chatProtocol: "ollama_chat",
      privacyClass: "on_device",
      costClass: "free_local",
      priority: 10,
      userEnabled: true,
      defaultCapabilities: capabilities({ structuredOutput: true }),
    },
    {
      id: "lm_studio",
      displayName: "LM Studio",
      baseUrl: "http://localhost:1234",
      authentication: { method: "none", credentialRef: null },
      discovery: "openai_models",
      chatProtocol: "openai_chat",
      privacyClass: "on_device",
      costClass: "free_local",
      priority: 20,
      userEnabled: false,
      defaultCapabilities: capabilities(),
    },
    {
      id: "llama_cpp",
      displayName: "llama.cpp server",
      baseUrl: "http://localhost:8080",
      authentication: { method: "none", credentialRef: null },
      discovery: "openai_models",
      chatProtocol: "openai_chat",
      privacyClass: "on_device",
      costClass: "free_local",
      priority: 30,
      userEnabled: false,
      defaultCapabilities: capabilities(),
    },
    {
      id: "localai",
      displayName: "LocalAI",
      baseUrl: "http://localhost:8080",
      authentication: { method: "optional_bearer", credentialRef: "localai_token" },
      discovery: "openai_models",
      chatProtocol: "openai_chat",
      privacyClass: "on_device",
      costClass: "free_local",
      priority: 40,
      userEnabled: false,
      defaultCapabilities: capabilities(),
    },
    {
      id: "vllm",
      displayName: "vLLM",
      baseUrl: "http://localhost:8000",
      authentication: { method: "optional_bearer", credentialRef: "vllm_token" },
      discovery: "openai_models",
      chatProtocol: "openai_chat",
      privacyClass: "on_device",
      costClass: "free_local",
      priority: 50,
      userEnabled: false,
      defaultCapabilities: capabilities(),
    },
    {
      id: "jan",
      displayName: "Jan local API",
      baseUrl: "http://localhost:1337",
      authentication: { method: "optional_bearer", credentialRef: "jan_token" },
      discovery: "openai_models",
      chatProtocol: "openai_chat",
      privacyClass: "on_device",
      costClass: "free_local",
      priority: 60,
      userEnabled: false,
      defaultCapabilities: capabilities(),
    },
    {
      id: "koboldcpp",
      displayName: "KoboldCpp",
      baseUrl: "http://localhost:5001",
      authentication: { method: "none", credentialRef: null },
      discovery: "kobold_model",
      chatProtocol: "openai_chat",
      privacyClass: "on_device",
      costClass: "free_local",
      priority: 70,
      userEnabled: false,
      defaultCapabilities: capabilities({ structuredOutput: false }),
    },
    {
      id: "openai_compatible",
      displayName: "Generic OpenAI-compatible local endpoint",
      baseUrl: "http://localhost:8001",
      authentication: {
        method: "optional_bearer",
        credentialRef: "openai_compatible_token",
      },
      discovery: "openai_models",
      chatProtocol: "openai_chat",
      privacyClass: "private_network",
      costClass: "free_local",
      priority: 80,
      userEnabled: false,
      defaultCapabilities: capabilities(),
    },
    {
      id: "openai",
      displayName: "OpenAI API (optional)",
      baseUrl: "https://api.openai.com",
      authentication: { method: "required_bearer", credentialRef: "openai_api_key" },
      discovery: "openai_models",
      chatProtocol: "openai_chat",
      privacyClass: "cloud",
      costClass: "metered",
      priority: 100,
      userEnabled: false,
      defaultCapabilities: capabilities({
        contextTokens: 400_000,
        structuredOutput: true,
        toolUse: true,
        expectedRamMb: 0,
        expectedGpuMemoryMb: 0,
      }),
    },
  ];
  return manifests.map((manifest) => ({
    ...manifest,
    authentication: { ...manifest.authentication },
    defaultCapabilities: { ...manifest.defaultCapabilities },
  }));
}

export const REQUIRED_MODEL_PROVIDER_IDS: ModelProviderId[] = [
  "ollama",
  "lm_studio",
  "llama_cpp",
  "localai",
  "vllm",
  "jan",
  "koboldcpp",
  "openai_compatible",
  "openai",
];

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

/** Refuse public HTTP endpoints and credential-bearing URLs. */
export function validateProviderBaseUrl(
  baseUrl: string,
  privacyClass: ProviderPrivacyClass,
): string | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return "Provider base URL is invalid.";
  }
  if (url.username || url.password || url.search || url.hash) {
    return "Provider URLs cannot contain credentials, query strings or fragments.";
  }
  if (privacyClass === "cloud") {
    if (url.protocol !== "https:") return "Cloud providers require HTTPS.";
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Local providers require HTTP or HTTPS.";
  }
  if (!LOCAL_HOSTS.has(url.hostname) && !isPrivateIpv4(url.hostname)) {
    return "Local providers must use loopback or a private-network address.";
  }
  return null;
}

function emptyRuntimeState(): ProviderRuntimeState {
  return {
    health: "unknown",
    latencyMs: null,
    rateLimitUntil: null,
    circuitState: "closed",
    circuitOpenUntil: null,
    consecutiveFailures: 0,
    lastSuccessfulRequest: null,
    lastFailure: null,
    models: [],
  };
}

function boundedText(value: unknown, max = 500): string | null {
  return typeof value === "string" && value.trim() && value.length <= max ? value : null;
}

function inferCapabilities(
  provider: ProviderManifest,
  modelId: string,
  source: Record<string, unknown>,
): ModelCapabilities {
  const lowered = modelId.toLowerCase();
  const context =
    Number(source.context_length ?? source.max_model_len ?? source.context_window) ||
    provider.defaultCapabilities.contextTokens;
  const sizeBytes = Number(source.size);
  const expectedRamMb =
    Number.isFinite(sizeBytes) && sizeBytes > 0
      ? Math.ceil((sizeBytes / (1024 * 1024)) * 1.25)
      : provider.defaultCapabilities.expectedRamMb;
  const declared = Array.isArray(source.capabilities)
    ? source.capabilities.filter((item): item is string => typeof item === "string")
    : [];
  const hasCapability = (pattern: RegExp) => declared.some((item) => pattern.test(item));
  return {
    ...provider.defaultCapabilities,
    contextTokens: Number.isFinite(context) && context > 0 ? Math.min(context, 10_000_000) : 32_768,
    structuredOutput:
      provider.defaultCapabilities.structuredOutput || hasCapability(/structured|json/i),
    toolUse: provider.defaultCapabilities.toolUse || hasCapability(/tool|function/i),
    vision:
      provider.defaultCapabilities.vision ||
      hasCapability(/vision|image|multimodal/i) ||
      /(vision|llava|vl\b|multimodal|moondream)/i.test(lowered),
    coding:
      provider.defaultCapabilities.coding ||
      hasCapability(/code|programming/i) ||
      /(code|coder|codestral|starcoder|deepseek-coder)/i.test(lowered),
    embedding:
      provider.defaultCapabilities.embedding ||
      hasCapability(/embed/i) ||
      /(embed|bge-|e5-)/i.test(lowered),
    expectedRamMb,
  };
}

function modelFrom(provider: ProviderManifest, value: unknown): ProviderModel | null {
  if (typeof value === "string") {
    const id = boundedText(value);
    return id
      ? {
          providerId: provider.id,
          id,
          displayName: id,
          capabilities: inferCapabilities(provider, id, {}),
        }
      : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = boundedText(row.id ?? row.name ?? row.model);
  if (!id) return null;
  return {
    providerId: provider.id,
    id,
    displayName: boundedText(row.display_name ?? row.name ?? row.id) ?? id,
    capabilities: inferCapabilities(provider, id, row),
  };
}

function parseModels(provider: ProviderManifest, body: unknown): ProviderModel[] {
  let values: unknown[] = [];
  if (provider.discovery === "ollama_tags") {
    if (
      body &&
      typeof body === "object" &&
      Array.isArray((body as { models?: unknown[] }).models)
    ) {
      values = (body as { models: unknown[] }).models;
    }
  } else if (provider.discovery === "kobold_model") {
    if (body && typeof body === "object") {
      const result =
        (body as { result?: unknown; model?: unknown }).result ??
        (body as { model?: unknown }).model;
      if (result !== undefined) values = [result];
    }
  } else if (
    body &&
    typeof body === "object" &&
    Array.isArray((body as { data?: unknown[] }).data)
  ) {
    values = (body as { data: unknown[] }).data;
  }
  return values
    .slice(0, MAX_DISCOVERED_MODELS)
    .map((value) => modelFrom(provider, value))
    .filter((value): value is ProviderModel => value !== null);
}

function endpoint(provider: ProviderManifest, kind: "discover" | "chat"): string {
  const base = provider.baseUrl.replace(/\/+$/, "");
  if (kind === "chat") {
    return provider.chatProtocol === "ollama_chat"
      ? `${base}/api/chat`
      : `${base}/v1/chat/completions`;
  }
  if (provider.discovery === "ollama_tags") return `${base}/api/tags`;
  if (provider.discovery === "kobold_model") return `${base}/api/v1/model`;
  return `${base}/v1/models`;
}

function sanitizedReason(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  return raw
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/sk-[a-z0-9_-]{8,}/gi, "[redacted]")
    .slice(0, 500);
}

function failureKind(status: number | null, reason: string): FabricAttempt["outcome"] {
  if (status === 429) return "rate_limit";
  if (status === 413) return "context_overflow";
  if (status === 507) return "out_of_memory";
  if (/timeout|timed out|abort/i.test(reason)) return "timeout";
  if (/context|token limit|too long/i.test(reason)) return "context_overflow";
  if (/out of memory|\boom\b|cuda.*memory/i.test(reason)) return "out_of_memory";
  if (/malformed|invalid json|tool call/i.test(reason)) return "malformed";
  return "unhealthy";
}

function isAllowedByPrivacy(manifest: ProviderManifest, requirement: ModelRequirement): boolean {
  if (manifest.privacyClass === "cloud") {
    return requirement.privacy === "allow_cloud" && requirement.allowMetered;
  }
  if (manifest.privacyClass === "private_network") {
    return requirement.privacy !== "local_only";
  }
  return true;
}

function supports(model: ProviderModel, requirement: ModelRequirement): boolean {
  const c = model.capabilities;
  return (
    c.contextTokens >= requirement.contextTokens &&
    (!requirement.structuredOutput || c.structuredOutput) &&
    (!requirement.toolUse || c.toolUse) &&
    (!requirement.vision || c.vision) &&
    (!requirement.coding || c.coding) &&
    (!requirement.embedding || c.embedding) &&
    c.expectedRamMb <= requirement.availableRamMb &&
    c.expectedGpuMemoryMb <= requirement.availableGpuMemoryMb
  );
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Provider returned malformed JSON.");
  }
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
    if (new Set(manifests.map((provider) => provider.id)).size !== manifests.length) {
      throw new Error("Provider ids must be unique.");
    }
    for (const provider of manifests) {
      const urlIssue = validateProviderBaseUrl(provider.baseUrl, provider.privacyClass);
      if (urlIssue) throw new Error(`${provider.id}: ${urlIssue}`);
      if (
        !REQUIRED_MODEL_PROVIDER_IDS.includes(provider.id) ||
        !Number.isInteger(provider.priority) ||
        provider.priority < 0
      ) {
        throw new Error("Provider manifest is malformed.");
      }
      this.manifests.set(provider.id, {
        ...provider,
        authentication: { ...provider.authentication },
        defaultCapabilities: { ...provider.defaultCapabilities },
      });
      this.runtime.set(provider.id, emptyRuntimeState());
    }
  }

  configure(
    providerId: ModelProviderId,
    patch: { baseUrl?: string; userEnabled?: boolean; priority?: number },
  ): void {
    const current = this.manifests.get(providerId);
    if (!current) throw new Error("Unknown provider.");
    const next = { ...current, ...patch };
    const urlIssue = validateProviderBaseUrl(next.baseUrl, next.privacyClass);
    if (urlIssue) throw new Error(urlIssue);
    if (!Number.isInteger(next.priority) || next.priority < 0 || next.priority > 10_000) {
      throw new Error("Provider priority is invalid.");
    }
    this.manifests.set(providerId, next);
    this.runtime.set(providerId, emptyRuntimeState());
  }

  snapshots(): ProviderSnapshot[] {
    return [...this.manifests.values()]
      .map((manifest) => ({
        ...manifest,
        authentication: { ...manifest.authentication },
        defaultCapabilities: { ...manifest.defaultCapabilities },
        ...this.runtime.get(manifest.id)!,
        models: this.runtime.get(manifest.id)!.models.map((model) => ({
          ...model,
          capabilities: { ...model.capabilities },
        })),
      }))
      .sort((left, right) => left.priority - right.priority);
  }

  private async headers(provider: ProviderManifest): Promise<Record<string, string>> {
    const headers: Record<string, string> = { accept: "application/json" };
    const credentialRef = provider.authentication.credentialRef;
    const secret = credentialRef ? await this.credentials(credentialRef) : null;
    if (provider.authentication.method === "required_bearer" && !secret) {
      throw new Error("Provider credential is not configured.");
    }
    if (secret) headers.authorization = `Bearer ${secret}`;
    return headers;
  }

  async discover(providerId: ModelProviderId, timeoutMs = 4_000): Promise<ProviderSnapshot> {
    const provider = this.manifests.get(providerId);
    if (!provider) throw new Error("Unknown provider.");
    const state = this.runtime.get(providerId)!;
    if (!provider.userEnabled) {
      state.health = "unknown";
      state.lastFailure = "Provider is disabled by the user.";
      return this.snapshots().find((item) => item.id === providerId)!;
    }
    const started = this.now();
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("Provider discovery timed out.")),
      timeoutMs,
    );
    let response: Response | undefined;
    try {
      response = await this.fetchImpl(endpoint(provider, "discover"), {
        headers: await this.headers(provider),
        signal: controller.signal,
      });
      const latency = Math.max(0, this.now() - started);
      if (!response.ok) throw new Error(`Provider discovery HTTP ${response.status}.`);
      const models = parseModels(provider, await responseBody(response));
      if (models.length === 0) throw new Error("Provider returned no usable models.");
      Object.assign(state, {
        health: "healthy" as const,
        latencyMs: latency,
        rateLimitUntil: null,
        circuitState: "closed" as const,
        circuitOpenUntil: null,
        consecutiveFailures: 0,
        lastSuccessfulRequest: new Date(this.now()).toISOString(),
        lastFailure: null,
        models,
      });
    } catch (cause) {
      state.models = [];
      const reason = sanitizedReason(cause);
      this.openCircuit(providerId, failureKind(response?.status ?? null, reason), reason, response);
    } finally {
      clearTimeout(timer);
    }
    return this.snapshots().find((item) => item.id === providerId)!;
  }

  async discoverEnabled(timeoutMs = 4_000): Promise<ProviderSnapshot[]> {
    await Promise.all(
      [...this.manifests.values()]
        .filter((provider) => provider.userEnabled)
        .map((provider) => this.discover(provider.id, timeoutMs)),
    );
    return this.snapshots();
  }

  route(requirement: ModelRequirement): ProviderModel[] {
    const now = this.now();
    const candidates: Array<{
      provider: ProviderManifest;
      state: ProviderRuntimeState;
      model: ProviderModel;
    }> = [];
    for (const provider of this.manifests.values()) {
      const state = this.runtime.get(provider.id)!;
      if (!provider.userEnabled || !isAllowedByPrivacy(provider, requirement)) continue;
      if (state.rateLimitUntil && state.rateLimitUntil > now) continue;
      if (state.circuitOpenUntil && state.circuitOpenUntil > now) continue;
      if (
        state.circuitState === "open" &&
        (!state.circuitOpenUntil || state.circuitOpenUntil > now)
      ) {
        continue;
      }
      if (state.circuitState === "open") state.circuitState = "half_open";
      if (state.health !== "healthy" && state.circuitState !== "half_open") continue;
      if (
        requirement.maxLatencyMs !== undefined &&
        state.latencyMs !== null &&
        state.latencyMs > requirement.maxLatencyMs
      ) {
        continue;
      }
      for (const model of state.models) {
        if (supports(model, requirement)) candidates.push({ provider, state, model });
      }
    }
    return candidates
      .sort((left, right) => {
        const locality =
          Number(left.provider.privacyClass !== "on_device") -
          Number(right.provider.privacyClass !== "on_device");
        if (locality !== 0) return locality;
        const ram = left.model.capabilities.expectedRamMb - right.model.capabilities.expectedRamMb;
        if (ram !== 0) return ram;
        const gpu =
          left.model.capabilities.expectedGpuMemoryMb -
          right.model.capabilities.expectedGpuMemoryMb;
        if (gpu !== 0) return gpu;
        const latency = (left.state.latencyMs ?? Infinity) - (right.state.latencyMs ?? Infinity);
        if (latency !== 0) return latency;
        return left.provider.priority - right.provider.priority;
      })
      .map((entry) => entry.model);
  }

  private openCircuit(
    providerId: ModelProviderId,
    kind: FabricAttempt["outcome"],
    reason: string,
    response?: Response,
  ): void {
    const state = this.runtime.get(providerId)!;
    const now = this.now();
    state.consecutiveFailures += 1;
    state.lastFailure = sanitizedReason(reason);
    state.health = kind === "rate_limit" ? "rate_limited" : "unhealthy";
    if (kind === "rate_limit") {
      const retrySeconds = Number(response?.headers.get("retry-after"));
      state.rateLimitUntil =
        now +
        (Number.isFinite(retrySeconds) && retrySeconds > 0
          ? Math.min(retrySeconds * 1_000, 60 * 60 * 1_000)
          : RATE_LIMIT_COOLDOWN_MS);
    }
    state.circuitState = "open";
    state.circuitOpenUntil = now + CIRCUIT_COOLDOWN_MS;
  }

  private recordSuccess(providerId: ModelProviderId, latencyMs: number): void {
    const state = this.runtime.get(providerId)!;
    Object.assign(state, {
      health: "healthy" as const,
      latencyMs,
      rateLimitUntil: null,
      circuitState: "closed" as const,
      circuitOpenUntil: null,
      consecutiveFailures: 0,
      lastSuccessfulRequest: new Date(this.now()).toISOString(),
      lastFailure: null,
    });
  }

  async chat(request: FabricChatRequest): Promise<FabricChatOutcome> {
    if (
      request.messages.length === 0 ||
      request.messages.length > MAX_MESSAGES ||
      request.messages.some(
        (message) =>
          !["system", "user", "assistant"].includes(message.role) ||
          typeof message.content !== "string" ||
          message.content.length > MAX_MESSAGE_LENGTH,
      ) ||
      (request.maxOutputTokens !== undefined &&
        (!Number.isInteger(request.maxOutputTokens) ||
          request.maxOutputTokens < 1 ||
          request.maxOutputTokens > MAX_OUTPUT_TOKENS)) ||
      (request.timeoutMs !== undefined &&
        (!Number.isInteger(request.timeoutMs) ||
          request.timeoutMs < 1 ||
          request.timeoutMs > 120_000))
    ) {
      return {
        ok: false,
        reason: "The model request is malformed or outside bounded limits.",
        attempts: [],
        remediation: "reduce_output",
      };
    }
    const candidates = this.route(request.requirement);
    if (candidates.length === 0) {
      return {
        ok: false,
        reason:
          "No enabled healthy model satisfies the capability, privacy and resource requirements.",
        attempts: [],
        remediation:
          request.requirement.contextTokens > 32_768 ? "split_task" : "missing_capability",
      };
    }

    const attempts: FabricAttempt[] = [];
    const failedProviders = new Set<ModelProviderId>();
    for (const model of candidates) {
      if (failedProviders.has(model.providerId)) continue;
      if (request.signal?.aborted) {
        return {
          ok: false,
          reason: "Model routing was cancelled.",
          attempts,
          remediation: "missing_capability",
        };
      }
      const provider = this.manifests.get(model.providerId)!;
      const started = this.now();
      let response: Response | undefined;
      const controller = new AbortController();
      const abortFromParent = () => controller.abort(request.signal?.reason);
      if (request.signal?.aborted) abortFromParent();
      else request.signal?.addEventListener("abort", abortFromParent, { once: true });
      const timer = setTimeout(
        () => controller.abort(new Error("Provider request timed out.")),
        request.timeoutMs ?? 30_000,
      );
      try {
        const body =
          provider.chatProtocol === "ollama_chat"
            ? {
                model: model.id,
                messages: request.messages,
                stream: false,
                options: {
                  temperature: request.temperature,
                  num_predict: request.maxOutputTokens,
                },
              }
            : {
                model: model.id,
                messages: request.messages,
                stream: false,
                temperature: request.temperature,
                max_tokens: request.maxOutputTokens,
                ...(request.requirement.structuredOutput
                  ? { response_format: { type: "json_object" } }
                  : {}),
              };
        response = await this.fetchImpl(endpoint(provider, "chat"), {
          method: "POST",
          headers: { ...(await this.headers(provider)), "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Provider HTTP ${response.status}.`);
        }
        const parsed = (await responseBody(response)) as {
          message?: { content?: unknown };
          choices?: Array<{ message?: { content?: unknown; tool_calls?: unknown } }>;
        };
        const message =
          provider.chatProtocol === "ollama_chat" ? parsed.message : parsed.choices?.[0]?.message;
        const content = typeof message?.content === "string" ? message.content : null;
        if (!content) throw new Error("Provider returned malformed completion content.");
        if (request.requirement.structuredOutput) {
          try {
            JSON.parse(content);
          } catch {
            throw new Error("Provider returned malformed structured output.");
          }
        }
        if (request.requirement.toolUse && provider.chatProtocol === "openai_chat") {
          const toolCalls = (message as { tool_calls?: unknown } | undefined)?.tool_calls;
          if (toolCalls !== undefined && !Array.isArray(toolCalls)) {
            throw new Error("Provider returned malformed tool calls.");
          }
        }
        const latency = Math.max(0, this.now() - started);
        this.recordSuccess(provider.id, latency);
        attempts.push({
          providerId: provider.id,
          modelId: model.id,
          outcome: "succeeded",
          evidence: `Provider returned bounded completion content in ${latency} ms.`,
        });
        return {
          ok: true,
          content,
          providerId: provider.id,
          modelId: model.id,
          attempts,
          evidence: `Selected the smallest capable healthy ${
            provider.privacyClass === "cloud" ? "allowed cloud" : "local"
          } model after ${attempts.length} attempt(s).`,
        };
      } catch (cause) {
        const reason = sanitizedReason(cause);
        const kind = failureKind(response?.status ?? null, reason);
        this.openCircuit(provider.id, kind, reason, response);
        failedProviders.add(provider.id);
        attempts.push({
          providerId: provider.id,
          modelId: model.id,
          outcome: kind,
          evidence: reason,
        });
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", abortFromParent);
      }
    }
    const hasContextFailure = attempts.some((attempt) => attempt.outcome === "context_overflow");
    return {
      ok: false,
      reason: `All ${attempts.length} compatible provider attempt(s) failed closed.`,
      attempts,
      remediation: hasContextFailure ? "split_task" : "deterministic_tool",
    };
  }
}

/** Adapt the fabric to Phase 21 without granting the model any tool authority. */
export function createModelFabricBrain(
  fabric: ModelProviderFabric,
  requirement: ModelRequirement,
): OcadeBrain {
  return {
    async propose(goal, signal) {
      const result = await fabric.chat({
        requirement: { ...requirement, structuredOutput: true },
        messages: [
          {
            role: "system",
            content:
              "Return one bounded OCADE BrainProposal JSON object. Do not execute tools or claim operating-system authority.",
          },
          { role: "user", content: goal },
        ],
        maxOutputTokens: 8_192,
        signal,
      });
      if (!result.ok) throw new Error(result.reason);
      try {
        return JSON.parse(result.content);
      } catch {
        throw new Error("The selected model returned malformed plan JSON.");
      }
    },
  };
}
