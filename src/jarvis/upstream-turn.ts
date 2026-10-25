/**
 * A JARVIS turn run by DeepSeek Harness's own agent loop, vendored verbatim in
 * src/deepseek/upstream (https://github.com/deepseek-ai/deepseek-harness at
 * 687f282e8625c6b8d11ff58211a90524be2e4317, MIT; see src/jarvis/THIRD_PARTY_NOTICES.md).
 *
 * The upstream loop owns the turn's mechanics: its event log, the step lifecycle, model-ordered
 * tool scheduling (read-only calls in a bounded pool, every effect alone; an abort drains the
 * started calls and answers the unstarted ones), the step-boundary hook and turn conclusion.
 * OCADE keeps every authority: the model call and its routing (`model`), each tool's
 * validation, permissions, STOP, confirmations and verification (`runTool`), and the task
 * record. The upstream session lives in memory for one turn; OCADE's records stay the truth.
 */
import { Context } from "@deepseek-ai/cordis";
import AgentRegistry, { type Agent } from "@deepseek-ai/dsh-agent";
import AgentLoop from "@deepseek-ai/dsh-agent-loop";
import LlmRuntime, {
  createUserMessage,
  LlmAdapter,
  ToolCallId,
  type ContentBlock,
  type GenerateOptions,
  type LlmResolvedModelInfo,
  type RequestMessage,
  type StreamChunk,
} from "@deepseek-ai/dsh-llm";
import SessionStore, { SessionId } from "@deepseek-ai/dsh-session";
import SessionProjectionRegistry from "@deepseek-ai/dsh-session-projection";
import SystemPrompt from "@deepseek-ai/dsh-system-prompt";
import ToolRuntime, { type ToolDefinition } from "@deepseek-ai/dsh-tools";
import type {
  NormalizedAssistantPart,
  NormalizedMessage,
  NormalizedToolCall,
} from "@/lib/intelligence/contract";
import { pruneOlderResults, TURN_BUDGET, toolResultMessage } from "./engine";

/** One model reply as OCADE's model call returns it. */
export interface UpstreamStep {
  text: string;
  toolCalls: NormalizedToolCall[];
  parts?: NormalizedAssistantPart[];
}

export interface UpstreamTurnIO {
  /** OCADE's tools, by name. A call to any other name is still answered by `runTool`. */
  tools: readonly string[];
  /** Calls that only read and may run beside each other. */
  readOnly(name: string): boolean;
  /** OCADE's model call for exactly these messages; null when no use was available. */
  model(messages: NormalizedMessage[]): Promise<UpstreamStep | null>;
  /** OCADE's tool authority. A throw ends the turn once the started calls settle. */
  runTool(call: NormalizedToolCall): Promise<unknown>;
  /** Whether this result ends the turn with no further model call (a recorded finish). */
  concludes(call: NormalizedToolCall, result: unknown): boolean;
  /**
   * Before each model step, with this turn's results so far in the model's order: what the
   * person said meanwhile (sent as their message), null for nothing, or "end" to end the turn.
   */
  beforeStep(step: number, results: readonly unknown[]): Promise<string | null | "end">;
  /** After each step that ran tools: this turn's work, as the model reads it next. */
  afterTools(work: NormalizedMessage[]): void;
  /** A result whose page or screen a newer one replaced (agent.ts `superseded`). */
  supersede(result: unknown): unknown;
  /** Whether a result shows a page or screen (agent.ts `observationOf`). */
  observes(result: unknown): boolean;
}

/** How a turn ended, for OCADE to settle the task. */
export type TurnEnd =
  /** The last reply called no tool. */
  | "answered"
  /** A result concluded it (`concludes`). */
  | "concluded"
  /** `beforeStep` ended it. */
  | "ended"
  /** STOP cancelled it. */
  | "stopped"
  | "no_model_use";

/** What a call that never ran reads, by why it never ran. */
const NOT_RUN = {
  stopped: { status: "not_run", summary: "Stopped before this call ran." },
  failed: { status: "not_run", summary: "This call did not finish. No result is recorded." },
};

/** OCADE's reply, carried on the logged assistant message as the adapter's replay state. */
interface Replay {
  reply: UpstreamStep;
}

/** One message of the turn as OCADE reads it, before rendering. */
type Entry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; reply: UpstreamStep }
  | { kind: "tool"; call: NormalizedToolCall; value: unknown };

/**
 * The upstream loop for one turn. `prefix` is what OCADE holds before this turn (its rules,
 * saved preferences, the conversation so far); the loop's own log starts with the person's text.
 */
export class UpstreamTurn {
  private readonly ctx = new Context();
  private agent!: Agent;
  /** The model's calls by the unique id the loop logs them under (providers may repeat ids). */
  private readonly calls = new Map<string, NormalizedToolCall>();
  /**
   * OCADE's answer to each call that finished, and to a call naming a tool OCADE does not offer
   * (the registry never runs those). It wins over the log's copy: on a cancellation the loop
   * logs "aborted" even for a call that finished, and a device step that did happen must never
   * read as not run, or a resumed task repeats it (audit B05).
   */
  private readonly answers = new Map<string, unknown>();
  private failure: { error: unknown } | null = null;
  private noUse = false;
  private ended = false;
  private concluded = false;
  private serial = 0;

  private constructor(
    private readonly prefix: NormalizedMessage[],
    private readonly io: UpstreamTurnIO,
  ) {}

  static async open(
    prefix: NormalizedMessage[],
    io: UpstreamTurnIO,
    signal: AbortSignal,
  ): Promise<UpstreamTurn> {
    const turn = new UpstreamTurn(prefix, io);
    const { ctx } = turn;
    await ctx.plugin(LlmRuntime);
    await ctx.plugin(SessionStore);
    await ctx.plugin(SessionProjectionRegistry);
    await ctx.plugin(SystemPrompt, { personaPrefix: "" });
    await ctx.plugin(ToolRuntime);
    await ctx.plugin(AgentRegistry);
    await ctx.plugin(AgentLoop, { agents: [], maxParallelToolCalls: TURN_BUDGET.parallelReads });
    ctx.llm.registerAdapter(["ocade"], new OcadeModel(turn));
    for (const name of io.tools) ctx.tools.register(turn.tool(name));
    ctx.on("agent/pre-step", async ({ step }, next) => {
      const decision = await next();
      if (decision.kind === "reject") return decision;
      let said: string | null | "end";
      try {
        said = await io.beforeStep(step, turn.results());
      } catch (error) {
        turn.fail(error);
        throw error;
      }
      if (said === "end") {
        turn.ended = true;
        return { kind: "reject" };
      }
      if (said === null) return decision;
      const message = createUserMessage({
        content: [{ type: "text", text: said }],
        source: { kind: "user" },
      });
      return { ...decision, messages: [...decision.messages, message] };
    });
    ctx.on("session/event", (session, event) => {
      if (session !== turn.agent?.session || event.type !== "step/end") return;
      const work = turn.work();
      if (work.some((message) => message.toolResult)) io.afterTools(work);
    });
    turn.agent = await ctx.agentLoop.create(SessionId(crypto.randomUUID()), {
      provider: "ocade",
      model: "ocade",
    });
    const stop = () => turn.agent.cancel({ kind: "user" });
    if (signal.aborted) stop();
    else signal.addEventListener("abort", stop, { once: true });
    return turn;
  }

  /** One OCADE tool as the upstream registry runs it. OCADE validates its own arguments. */
  private tool(name: string): ToolDefinition {
    return {
      name,
      description: name,
      parameters: { type: "object" },
      output: {
        schema: {},
        render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
      },
      isConcurrencySafe: () => this.io.readOnly(name),
      execute: async (_args, exec) => {
        const call = this.calls.get(exec.callId)!;
        try {
          const value = (await this.io.runTool(call)) ?? null;
          this.answers.set(exec.callId, value);
          if (this.io.concludes(call, value)) {
            this.concluded = true;
            exec.concludeTurn();
          }
          return value;
        } catch (error) {
          this.fail(error);
          return NOT_RUN.failed;
        }
      },
    };
  }

  /** Hold OCADE's failure for the caller and end the turn once the started calls settle. */
  private fail(error: unknown): void {
    this.failure ??= { error };
    this.agent.cancel({ kind: "hook", reason: "OCADE stopped this turn." });
  }

  /**
   * Run one person-side message through the loop until it is idle again. Throws what OCADE's
   * model call or a tool threw, after the work so far reached `afterTools`.
   */
  async run(text: string): Promise<TurnEnd> {
    this.ended = this.concluded = this.noUse = false;
    this.agent.followup(
      createUserMessage({ content: [{ type: "text", text }], source: { kind: "user" } }),
    );
    await this.agent.whenIdle();
    if (this.failure) throw this.failure.error;
    if (this.noUse) return "no_model_use";
    if (this.ended) return "ended";
    if (this.concluded) return "concluded";
    const end = this.lastTurnEnd();
    if (end?.kind === "aborted") return "stopped";
    if (end?.kind === "error") throw new Error(end.error?.message ?? "The turn failed.");
    return "answered";
  }

  /** Release the loop, once `run` has settled: the browser's async context needs it idle. */
  close(): Promise<void> {
    return this.ctx.fiber.dispose();
  }

  private lastTurnEnd(): { kind: string; error?: { message: string } } | undefined {
    const ends = this.agent.session.snapshotEvents().filter((event) => event.type === "turn/end");
    return (ends.at(-1)?.data as { reason: { kind: string; error?: { message: string } } })?.reason;
  }

  /** The log's messages for this turn: the person's, the model's and the tools'. */
  private logged(): RequestMessage[] {
    return this.agent.session.snapshotEvents().flatMap((event): RequestMessage[] => {
      if (event.type === "user/message") return [event.data as RequestMessage];
      if (event.type === "assistant/message" || event.type === "tool/result") {
        return [(event.data as { message: RequestMessage }).message];
      }
      return [];
    });
  }

  /** This turn's results in the model's order. */
  private results(): unknown[] {
    return this.entries(this.logged()).flatMap((entry) =>
      entry.kind === "tool" ? [entry.value] : [],
    );
  }

  /** OCADE's answer to one logged call, or why it never ran (the loop's own placeholder). */
  private valueOf(id: string): unknown {
    if (this.answers.has(id)) return this.answers.get(id);
    return this.failure ? NOT_RUN.failed : NOT_RUN.stopped;
  }

  private entries(messages: readonly RequestMessage[]): Entry[] {
    const entries: Entry[] = [];
    for (const message of messages) {
      if (message.role === "user") {
        entries.push({ kind: "user", text: textOf(message.content) });
      } else if (message.role === "assistant") {
        const replay = (message.source.replayState as { response?: Replay } | undefined)?.response;
        if (replay) entries.push({ kind: "assistant", reply: replay.reply });
      } else if (message.role === "tool") {
        const call = this.calls.get(message.toolCallId);
        if (call) {
          entries.push({ kind: "tool", call, value: this.valueOf(message.toolCallId) });
        }
      }
    }
    return entries;
  }

  /**
   * The messages OCADE's model call reads for this request: OCADE's prefix, then the turn as
   * logged, with OCADE's projection. A page or screen shown before the newest one keeps only
   * its digest, and every result older than the newest reply that called tools shrinks to
   * head and tail (engine.ts PRUNE).
   */
  messagesFor(request: readonly RequestMessage[]): NormalizedMessage[] {
    const entries = this.entries(request);
    let newest = -1;
    entries.forEach((entry, index) => {
      if (entry.kind === "tool" && this.io.observes(entry.value)) newest = index;
    });
    const rendered = entries.map((entry, index): NormalizedMessage => {
      if (entry.kind === "user") return { role: "user", content: entry.text };
      if (entry.kind === "tool") {
        const old = index < newest && this.io.observes(entry.value);
        return toolResultMessage(entry.call, old ? this.io.supersede(entry.value) : entry.value);
      }
      const { reply } = entry;
      return {
        role: "assistant",
        content: reply.text,
        ...(reply.toolCalls.length ? { toolCalls: reply.toolCalls } : {}),
        ...(reply.parts ? { parts: reply.parts } : {}),
      };
    });
    const messages = [...this.prefix, ...rendered];
    const lastCalling = rendered
      .map((message) => message.role === "assistant" && Boolean(message.toolCalls?.length))
      .lastIndexOf(true);
    if (lastCalling >= 0) pruneOlderResults(messages, this.prefix.length + lastCalling);
    return messages;
  }

  /** This turn's work after the person's message, as the model reads it next. */
  work(): NormalizedMessage[] {
    return this.messagesFor(this.logged()).slice(this.prefix.length + 1);
  }

  /** The adapter's side: one model step through OCADE, logged under unique call ids. */
  async step(options: GenerateOptions): Promise<StreamChunk[]> {
    let reply: UpstreamStep | null;
    try {
      reply = await this.io.model(this.messagesFor(options.messages));
    } catch (error) {
      this.fail(error);
      throw error;
    }
    if (!reply) {
      this.noUse = true;
      throw new Error("No model use was available.");
    }
    const chunks: StreamChunk[] = [];
    if (reply.text) {
      chunks.push(
        { type: "block-start", index: 0, blockType: "text" },
        { type: "block-end", index: 0, block: { type: "text", text: reply.text } },
      );
    }
    for (const call of reply.toolCalls) {
      const id = ToolCallId(`ocade-call-${(this.serial += 1)}`);
      const index = chunks.length / 2;
      this.calls.set(id, call);
      // The registry never runs a name OCADE does not offer: OCADE still answers it, its way.
      if (!this.io.tools.includes(call.name)) this.answers.set(id, await this.io.runTool(call));
      chunks.push(
        { type: "block-start", index, blockType: "tool-call" },
        {
          type: "block-end",
          index,
          block: {
            type: "tool-call",
            id,
            name: call.name,
            arguments: JSON.stringify(call.arguments ?? {}),
          },
        },
      );
    }
    // Lossless JSON, as the log requires: no undefined fields.
    const replay: Replay = { reply: JSON.parse(JSON.stringify(reply)) as UpstreamStep };
    chunks.push(
      { type: "usage", usage: { inputTokens: 0, outputTokens: 0 } },
      {
        type: "finish",
        reason: { kind: reply.toolCalls.length ? "tool-calls" : "stop" },
        replayState: { response: replay },
      },
    );
    return chunks;
  }
}

function textOf(content: readonly ContentBlock[]): string {
  return content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

/** The model adapter the upstream loop calls: every request goes through OCADE's own model call. */
class OcadeModel extends LlmAdapter {
  constructor(private readonly turn: UpstreamTurn) {
    super();
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model });
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    for (const chunk of await this.turn.step(options)) yield chunk;
  }
}
