/**
 * OCADE response streaming (master plan §4.2: streaming responses, stop
 * generation, retry).
 *
 * A streamed answer can end three ways, and conflating them is a quiet lie:
 *
 *  - **complete** — the model finished. The text is the whole answer.
 *  - **stopped** — the user hit stop. The text is a FRAGMENT, and must be
 *    labelled one. Presenting a stopped stream as a finished answer is how a
 *    half-sentence gets treated as a conclusion.
 *  - **errored** — the connection dropped. Whatever arrived is kept, but it is
 *    incomplete and marked so, with the reason.
 *
 * This is the state machine that keeps those three apart. Its invariants:
 * chunks are only accepted while streaming; a terminal state is final (no
 * resurrection); and `content()` always comes with a `truncated` flag so no
 * caller can render a fragment as whole by accident.
 *
 * Pure and synchronous — it models the stream's state; it does not open a
 * connection.
 */

export type StreamStatus = "idle" | "streaming" | "complete" | "stopped" | "errored";

export interface StreamSnapshot {
  status: StreamStatus;
  content: string;
  /** True unless the stream reached `complete`. A fragment is never "whole". */
  truncated: boolean;
  /** Present when errored. */
  error?: string;
  /** Chunks received so far. */
  chunks: number;
}

export type StreamOutcome<T> = { ok: true; data: T } | { ok: false; reason: string };

export interface ResponseStreamOptions {
  maxCharacters?: number;
  maxChunks?: number;
}

const DEFAULT_MAX_CHARACTERS = 1_000_000;
const DEFAULT_MAX_CHUNKS = 4_096;
const MAX_ERROR_CHARACTERS = 500;

/**
 * The disclosure line for a snapshot, in one place so the class method and any
 * UI render the identical wording (no duplicated rule to drift).
 */
export function streamDisclosure(snap: StreamSnapshot): string {
  switch (snap.status) {
    case "complete":
      return "";
    case "stopped":
      return "You stopped this reply — it's a fragment, not a finished answer.";
    case "errored":
      return `The connection dropped before this reply finished (${snap.error ?? "unknown error"}). What's shown is incomplete.`;
    case "streaming":
      return "Still generating…";
    case "idle":
      return "";
  }
}

export class ResponseStream {
  private status: StreamStatus = "idle";
  private buffer = "";
  private chunkCount = 0;
  private errorReason?: string;
  private readonly maxCharacters: number;
  private readonly maxChunks: number;

  constructor(options: ResponseStreamOptions = {}) {
    this.maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
    this.maxChunks = options.maxChunks ?? DEFAULT_MAX_CHUNKS;
    if (!Number.isInteger(this.maxCharacters) || this.maxCharacters < 1) {
      throw new Error("Stream character capacity must be a positive integer.");
    }
    if (!Number.isInteger(this.maxChunks) || this.maxChunks < 1) {
      throw new Error("Stream chunk capacity must be a positive integer.");
    }
  }

  /** Begin streaming. Only valid from idle. */
  start(): StreamOutcome<StreamSnapshot> {
    if (this.status !== "idle") {
      return { ok: false, reason: `Can't start a stream that is already ${this.status}.` };
    }
    this.status = "streaming";
    return { ok: true, data: this.snapshot() };
  }

  /**
   * Append a chunk. Rejected once the stream has ended — a late chunk after
   * stop/complete/error must not silently extend a finished answer.
   */
  push(chunk: string): StreamOutcome<StreamSnapshot> {
    if (this.status !== "streaming") {
      return { ok: false, reason: `Can't add to a stream that is ${this.status}.` };
    }
    if (typeof chunk !== "string" || chunk.length === 0) {
      return { ok: false, reason: "An empty stream chunk was refused." };
    }
    if (this.chunkCount >= this.maxChunks) {
      return this.exceedBudget(`The response exceeded its ${this.maxChunks}-chunk budget.`);
    }
    if (this.buffer.length + chunk.length > this.maxCharacters) {
      return this.exceedBudget(
        `The response exceeded its ${this.maxCharacters}-character memory budget.`,
      );
    }
    this.buffer += chunk;
    this.chunkCount++;
    return { ok: true, data: this.snapshot() };
  }

  /**
   * The model finished normally. Only then is the content NOT truncated.
   */
  complete(): StreamOutcome<StreamSnapshot> {
    if (this.status !== "streaming") {
      return { ok: false, reason: `Can't complete a stream that is ${this.status}.` };
    }
    this.status = "complete";
    return { ok: true, data: this.snapshot() };
  }

  /**
   * The user stopped generation. Whatever arrived is kept but is a fragment —
   * `truncated` stays true.
   */
  stop(): StreamOutcome<StreamSnapshot> {
    if (this.status !== "streaming") {
      return { ok: false, reason: `Can't stop a stream that is ${this.status}.` };
    }
    this.status = "stopped";
    return { ok: true, data: this.snapshot() };
  }

  /** The connection failed. Partial content is kept, marked incomplete. */
  fail(reason: string): StreamOutcome<StreamSnapshot> {
    if (this.status !== "streaming") {
      return { ok: false, reason: `Can't fail a stream that is ${this.status}.` };
    }
    this.status = "errored";
    this.errorReason =
      typeof reason === "string" && reason.trim()
        ? reason.trim().slice(0, MAX_ERROR_CHARACTERS)
        : "unknown error";
    return { ok: true, data: this.snapshot() };
  }

  snapshot(): StreamSnapshot {
    return {
      status: this.status,
      content: this.buffer,
      truncated: this.status !== "complete",
      ...(this.errorReason ? { error: this.errorReason } : {}),
      chunks: this.chunkCount,
    };
  }

  /**
   * The line shown beneath the message, telling the reader what they're looking
   * at. A stopped or errored answer says so; a complete one needs no caveat.
   */
  disclosure(): string {
    return streamDisclosure(this.snapshot());
  }

  /** Whether a retry is offered — only for the non-clean endings. */
  canRetry(): boolean {
    return this.status === "stopped" || this.status === "errored";
  }

  private exceedBudget(reason: string): StreamOutcome<StreamSnapshot> {
    this.status = "errored";
    this.errorReason = reason;
    return { ok: false, reason };
  }
}
