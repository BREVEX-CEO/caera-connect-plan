/**
 * The dependency-injection boundary the donor query loop is built around.
 *
 * WHY THIS FILE IS ADAPTED RATHER THAN COPIED
 * -------------------------------------------
 * The donor's `query/deps.ts` is four lines of types and a factory, and the
 * factory wires `callModel` to `queryModelWithStreaming` — a hosted inference
 * client. That client is the one thing OCADE must never have. Everything else
 * about the file is exactly right, and it is the reason the query loop is
 * portable at all: the loop never imports a model client, it asks `deps`.
 *
 * So the SHAPE is kept, the injection point is kept, and what gets injected is
 * OCADE's on-device engine. A test can hand the loop a fake and drive every
 * recovery path without a network, which is what the donor built this for.
 *
 * The donor's comment said the scope was "intentionally narrow (4 deps) to
 * prove the pattern" and that later work could add tool running and stop hooks.
 * OCADE takes that later step: `runTools` and `shouldStop` are injected too,
 * because both cross a runtime boundary here (tools reach the extension or the
 * companion; stopping is a user action) and neither belongs inside the loop.
 */

import type { ContentBlockParam, StopReason, Usage } from "../protocol/modelProtocol";

/** One message as the loop carries it. */
export interface QueryMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentBlockParam[];
}

/** A tool the model may call this turn. */
export interface QueryTool {
  name: string;
  description: string;
  input_schema: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
}

export interface QueryToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * What one model turn produced.
 *
 * `stopReason` matters more than it looks: `max_tokens` is the signal the
 * donor's recovery path keys on, and treating it as an ordinary completion is
 * how a truncated answer gets presented as a finished one.
 */
export interface QueryTurn {
  text: string;
  toolCalls: QueryToolCall[];
  stopReason: StopReason | null;
  usage?: Usage;
}

export interface CallModelInput {
  messages: readonly QueryMessage[];
  systemPrompt: string;
  tools: readonly QueryTool[];
  signal?: AbortSignal;
  onToken?: (chunk: string) => void;
  /** Set when the loop is retrying after a truncated response. */
  maxOutputTokensOverride?: number;
}

/** The result of running one tool call, as the loop needs to see it. */
export interface QueryToolResult {
  id: string;
  name: string;
  /** What the model is told. */
  content: string;
  isError: boolean;
  /** False when the executor looked for the change and did not find it. */
  verified?: boolean;
}

export interface QueryDeps {
  /**
   * One model turn.
   *
   * THE INJECTION POINT. In production this reaches OCADE's on-device engine —
   * WebGPU, then the WASM fallback, then a paired local runtime — and refuses
   * truthfully when none can serve the device. It never reaches a hosted model.
   */
  callModel: (input: CallModelInput) => Promise<QueryTurn>;

  /**
   * Run the tool calls from one turn, in order.
   *
   * Permission is decided inside this, before any executor is reached, which is
   * why the loop cannot be used to bypass the permission layer: it has no other
   * way to run anything.
   */
  runTools: (
    calls: readonly QueryToolCall[],
    signal?: AbortSignal,
  ) => Promise<QueryToolResult[]>;

  /** Reduce a long transcript. Returns null when nothing was compacted. */
  compact: (messages: readonly QueryMessage[]) => Promise<QueryMessage[] | null>;

  /** Rough token count for a transcript. Used for the compaction trigger. */
  countTokens: (messages: readonly QueryMessage[]) => number;

  /**
   * The donor's stop-hook gate, reduced to its one production meaning: may the
   * loop continue? Returning a string stops it and says why.
   */
  shouldStop?: () => string | null;

  uuid: () => string;
}
