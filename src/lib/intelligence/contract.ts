import type { GenerationSurface } from "@/lib/commercial/generation-gate";

/** The user-facing routing choice. Commercial permission is decided first. */
export type IntelligenceMode = "automatic" | "online" | "local_only";

/**
 * Internal provenance, and the customer never sees any of it.
 *
 * Two backends, because the product has two: the online boundary and the
 * on-device engine. It listed six while there were a WebGPU engine, an Ollama
 * bridge, a native mobile runtime and a paired desktop. Which one answered is
 * never a customer-facing fact: the interface says `OCADE` or `Offline`.
 */
export type IntelligenceBackend = "gemini_online" | "wasm_local";

export interface IntelligencePermit {
  id: string;
  generationId: string;
  idempotencyKey: string;
  surface: GenerationSurface;
  source: "server" | "offline_lease";
}

export interface NormalizedMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** Base64 payloads without data-URL prefixes. */
  images?: string[];
}

export interface NormalizedToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface NormalizedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface NormalizedToolResult {
  callId: string;
  content: string;
  isError?: boolean;
  verified?: boolean;
}

export interface NormalizedAttachment {
  name: string;
  mime: string;
  sizeBytes: number;
  /** Text extracted on-device, when the attachment is safe to send. */
  text?: string;
  /** Base64 image payload without a data-URL prefix. */
  image?: string;
}

/**
 * What this request is allowed to do with the network.
 *
 * `storageMode` used to sit here as a third field, naming where the account
 * kept its chats. It was doing two jobs badly: it was the reason a request was
 * refused, and it was also a description of a storage arrangement that
 * `PLAN.md` Phase 2 removed. What actually decides whether a request may leave
 * the device is the intelligence mode the person chose and whether the
 * conversation is sealed, and both of those are here.
 */
export interface IntelligencePrivacyPolicy {
  /** False for Local-only, and for anything OCADE asks on its own behalf. */
  onlineInferenceConsented: boolean;
  sealed: boolean;
}

export interface IntelligenceRequest {
  permit: IntelligencePermit;
  generationId: string;
  idempotencyKey: string;
  surface: GenerationSurface;
  mode: IntelligenceMode;
  messages: NormalizedMessage[];
  tools: NormalizedToolDefinition[];
  attachments: NormalizedAttachment[];
  privacy: IntelligencePrivacyPolicy;
  projectId?: string;
  conversationId?: string;
  taskId?: string;
  /** Internal continuation that must not replace the user-visible engine state. */
  background?: boolean;
  signal?: AbortSignal;
}

export interface NormalizedUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface NormalizedResponse {
  text: string;
  toolCalls: NormalizedToolCall[];
  toolResults: NormalizedToolResult[];
  backend: IntelligenceBackend;
  usage?: NormalizedUsage;
  stopReason: "end_turn" | "tool_use" | "cancelled";
}

export type IntelligenceRefusalCode =
  | "cancelled"
  | "invalid_permit"
  | "online_not_consented"
  | "online_unavailable"
  | "local_unavailable"
  | "provider_rate_limited"
  | "provider_failed"
  | "empty_response";

export type IntelligenceEvent =
  | { type: "status"; backend: IntelligenceBackend; state: string }
  | { type: "token"; text: string }
  | { type: "tool_call"; call: NormalizedToolCall }
  | { type: "tool_result"; result: NormalizedToolResult }
  | { type: "usage"; usage: NormalizedUsage }
  | {
      type: "refusal";
      code: IntelligenceRefusalCode;
      reason: string;
      /** Automatic mode may fall back only before meaningful output. */
      retryable: boolean;
    }
  | { type: "final"; response: NormalizedResponse };

export interface IntelligenceStatus {
  automatic: "ready" | "degraded" | "unavailable";
  online: "ready" | "unavailable";
  local: "ready" | "preparing" | "unavailable";
}

export interface IntelligenceCapabilities {
  modes: IntelligenceMode[];
  backends: IntelligenceBackend[];
  text: boolean;
  tools: boolean;
  vision: boolean;
}

export interface IntelligenceGenerationSuccess {
  ok: true;
  response: NormalizedResponse;
}

export interface IntelligenceGenerationFailure {
  ok: false;
  code: IntelligenceRefusalCode;
  reason: string;
  partialText: string;
}

export type IntelligenceGenerationResult =
  IntelligenceGenerationSuccess | IntelligenceGenerationFailure;

export interface OcadeIntelligence {
  status(): Promise<IntelligenceStatus>;
  capabilities(): Promise<IntelligenceCapabilities>;
  stream(request: IntelligenceRequest): AsyncIterable<IntelligenceEvent>;
  generate(request: IntelligenceRequest): Promise<IntelligenceGenerationResult>;
  cancel(generationId: string): Promise<void>;
}

export interface IntelligenceTransportStatus {
  available: boolean;
  state: "ready" | "preparing" | "unavailable";
  reason?: string;
  capabilities: { text: boolean; tools: boolean; vision: boolean };
}

/** A backend adapter. It owns transport, never commercial policy. */
export interface IntelligenceTransport {
  readonly backend: IntelligenceBackend;
  probe(signal?: AbortSignal): Promise<IntelligenceTransportStatus>;
  stream(request: IntelligenceRequest): AsyncIterable<IntelligenceEvent>;
  cancel?(generationId: string): Promise<void> | void;
}

export function assertIntelligencePermit(request: IntelligenceRequest): void {
  const { permit } = request;
  if (
    !permit?.id ||
    !permit.generationId ||
    !permit.idempotencyKey ||
    !permit.surface ||
    !["server", "offline_lease"].includes(permit.source) ||
    permit.generationId !== request.generationId ||
    permit.idempotencyKey !== request.idempotencyKey ||
    permit.surface !== request.surface
  ) {
    throw new Error(
      "A matching commercial generation permit is required before intelligence runs.",
    );
  }
  if (request.mode === "online" && permit.source === "offline_lease") {
    throw new Error("An offline usage allocation cannot authorize online intelligence.");
  }
}
