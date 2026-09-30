import type { GenerationSurface } from "../commercial/generation-gate.ts";

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
/*
 * TWO BACKENDS, NAMED FOR WHERE THEY RUN RATHER THAN FOR WHO SUPPLIES THEM.
 *
 * They were `gemini_online` and `wasm_local`, and the first of those travelled:
 * the Edge Function puts the backend into every status and final event it
 * streams, so a provider's name reached the browser on every request and sat in
 * the client bundle. `PLAN.md` says the customer interface never exposes a
 * provider, model or runtime identifier, and the cheapest way to keep that true
 * is for the identifier not to exist on this side of the boundary at all.
 */
export type IntelligenceBackend = "online" | "on_device";

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
  conversationId?: string;
  /**
   * Deliberate before answering.
   *
   * Only the local runtime honours it: the one artifact carries both modes and
   * its chat template chooses between them. The online boundary has no such
   * parameter, so a request that routes online simply answers directly — which
   * is why the control is offered only where it can be kept.
   */
  thinking?: boolean;
  /**
   * Look things up on the web before answering.
   *
   * Online only, and it is the provider's own grounded search rather than a
   * crawler of OCADE's own: no second Chat engine, no fetch loop, no
   * server-side request forgery surface, and the same auth, permit,
   * cancellation and persistence as any other request. The sources come back
   * with the answer and are shown with it.
   */
  research?: boolean;
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
  /** The request itself was refused by the model's content rules: never retried. */
  | "content_blocked"
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
