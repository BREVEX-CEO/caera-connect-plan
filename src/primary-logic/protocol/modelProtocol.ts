/**
 * The message protocol OCADE's runtime speaks.
 *
 * WHAT THIS REPLACED. The donor shipped this file as a wall of `export type X =
 * any` plus a hosted client class whose every method threw. That is worse than
 * nothing: `any` silences the compiler on exactly the boundary — tool calls and
 * their results — where a wrong shape becomes a runtime crash inside a tool the
 * user just approved. The client is gone entirely (OCADE performs no hosted
 * inference), and the types are real.
 *
 * They are deliberately structural rather than branded to any vendor. OCADE's
 * engines are on-device: a WebGPU runtime, a WASM runtime, and the local
 * companion. Each speaks its own wire format and each adapter converts into
 * these shapes, so the agent loop, the permission layer and the tool registry
 * see one protocol regardless of which engine answered.
 */

export type StopReason =
  | "end_turn"
  | "max_tokens"
  | "stop_sequence"
  | "tool_use"
  | "pause_turn"
  | "refusal";

export interface TextBlock {
  type: "text";
  text: string;
  citations?: unknown[] | null;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  signature?: string;
}

export interface RedactedThinkingBlock {
  type: "redacted_thinking";
  data: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface Base64ImageSource {
  type: "base64";
  media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
}

export interface UrlImageSource {
  type: "url";
  url: string;
}

export interface ImageBlockParam {
  type: "image";
  source: Base64ImageSource | UrlImageSource;
}

export interface TextBlockParam {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" } | null;
}

export interface ToolResultBlockParam {
  type: "tool_result";
  tool_use_id: string;
  content?: string | Array<TextBlockParam | ImageBlockParam>;
  is_error?: boolean;
}

export interface ToolUseBlockParam {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ThinkingBlockParam {
  type: "thinking";
  thinking: string;
  signature?: string;
}

export interface RedactedThinkingBlockParam {
  type: "redacted_thinking";
  data: string;
}

export interface DocumentBlockParam {
  type: "document";
  source: { type: "text"; media_type: "text/plain"; data: string };
  title?: string | null;
  context?: string | null;
}

/** A block a model produced. */
export type ContentBlock = TextBlock | ThinkingBlock | RedactedThinkingBlock | ToolUseBlock;

/** A block that may be sent to a model. */
export type ContentBlockParam =
  | TextBlockParam
  | ImageBlockParam
  | DocumentBlockParam
  | ToolUseBlockParam
  | ToolResultBlockParam
  | ThinkingBlockParam
  | RedactedThinkingBlockParam;

export interface MessageParam {
  role: "user" | "assistant";
  content: string | ContentBlockParam[];
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export type MessageDeltaUsage = Pick<Usage, "output_tokens">;

export interface Message {
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  model: string;
  stop_reason: StopReason | null;
  stop_sequence?: string | null;
  usage: Usage;
}

/** Incremental events an engine emits while a turn streams. */
export type RawMessageStreamEvent =
  | { type: "message_start"; message: Message }
  | { type: "content_block_start"; index: number; content_block: ContentBlock }
  | {
      type: "content_block_delta";
      index: number;
      delta:
        | { type: "text_delta"; text: string }
        | { type: "input_json_delta"; partial_json: string }
        | { type: "thinking_delta"; thinking: string }
        | { type: "signature_delta"; signature: string };
    }
  | { type: "content_block_stop"; index: number }
  | {
      type: "message_delta";
      delta: { stop_reason: StopReason | null; stop_sequence?: string | null };
      usage: MessageDeltaUsage;
    }
  | { type: "message_stop" };

/** A tool as it is presented to a model. */
export interface ToolSchema {
  name: string;
  description?: string;
  input_schema: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
}

export type ToolChoice =
  | { type: "auto"; disable_parallel_tool_use?: boolean }
  | { type: "any"; disable_parallel_tool_use?: boolean }
  | { type: "tool"; name: string; disable_parallel_tool_use?: boolean }
  | { type: "none" };

export type Stream<T = RawMessageStreamEvent> = AsyncIterable<T>;

/*
 * Names the donor's modules import. Kept as aliases rather than renamed at
 * every call site: the ported logic is large and stable, and a rename in a
 * thousand places is churn that hides real changes in review.
 */
export type BetaContentBlock = ContentBlock;
export type BetaContentBlockParam = ContentBlockParam;
export type BetaMessage = Message;
export type BetaMessageParam = MessageParam;
export type BetaRawMessageStreamEvent = RawMessageStreamEvent;
export type BetaStopReason = StopReason;
export type BetaTool = ToolSchema;
export type BetaToolUnion = ToolSchema;
export type BetaToolUseBlock = ToolUseBlock;
export type BetaToolResultBlockParam = ToolResultBlockParam;
export type BetaThinkingBlock = ThinkingBlock;
export type BetaRedactedThinkingBlock = RedactedThinkingBlock;
export type BetaImageBlockParam = ImageBlockParam;
export type BetaRequestDocumentBlock = DocumentBlockParam;
export type BetaUsage = Usage;
export type BetaMessageDeltaUsage = MessageDeltaUsage;

/**
 * Failures the runtime distinguishes.
 *
 * `EngineAbortError` is the one the agent loop must never treat as a fault: it
 * means the person pressed stop, and a stopped turn is a completed intention,
 * not an error to retry or apologise for.
 */
export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}

export class EngineUnavailableError extends EngineError {
  constructor(message = "No on-device engine can serve this request.") {
    super(message);
    this.name = "EngineUnavailableError";
  }
}

export class EngineTimeoutError extends EngineError {
  constructor(message = "The on-device engine did not respond in time.") {
    super(message);
    this.name = "EngineTimeoutError";
  }
}

export class EngineAbortError extends Error {
  constructor(message = "Stopped.") {
    super(message);
    this.name = "EngineAbortError";
  }
}

/** Donor aliases for the error classes. */
export const APIConnectionError = EngineUnavailableError;
export const APIConnectionTimeoutError = EngineTimeoutError;
export const APIUserAbortError = EngineAbortError;
export type APIError = EngineError;
