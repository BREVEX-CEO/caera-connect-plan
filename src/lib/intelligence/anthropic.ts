import {
  sseData,
  type NormalizedAttachment,
  type NormalizedMessage,
  type NormalizedToolDefinition,
} from "./contract.ts";
import type { ProviderFeature } from "./edge-handler.ts";

/**
 * THE ANTHROPIC MESSAGES ADAPTER (plan 14D.4.3), for a customer's own key or the owner's planner.
 *
 * Request: system text in `system`, alternating user/assistant turns, assistant tool calls as
 * `tool_use` blocks and their results as `tool_result` blocks in the next user turn, images as
 * base64 `image` blocks. A forced call is `tool_choice: {type: "any"}`. Opaque thoughts and
 * Google signatures never enter it.
 *
 * Response: the provider's event stream converted to the same Gemini-shaped stream every other
 * adapter yields, so the one existing settlement owner decides. Calls are released only after a
 * valid `message_stop`; a truncated stream can never cause an action.
 */
export const ANTHROPIC_VERSION = "2023-06-01";

type Block = Record<string, unknown>;

export function anthropicBody(
  input: {
    messages: NormalizedMessage[];
    tools: NormalizedToolDefinition[];
    attachments: NormalizedAttachment[];
  },
  maxTokens: number,
  model: string,
  sent?: ReadonlySet<ProviderFeature>,
): Record<string, unknown> {
  const system = input.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const turns: { role: "user" | "assistant"; content: Block[] }[] = [];
  const push = (role: "user" | "assistant", blocks: Block[]) => {
    if (blocks.length === 0) return;
    const last = turns.at(-1);
    // The API wants turns to alternate: consecutive same-role turns are merged.
    if (last?.role === role) last.content.push(...blocks);
    else turns.push({ role, content: blocks });
  };
  for (const message of input.messages) {
    if (message.role === "system") continue;
    if (message.toolResult) {
      push("user", [
        { type: "tool_result", tool_use_id: message.toolResult.callId, content: message.content },
      ]);
      continue;
    }
    const text = message.parts
      ? message.parts
          .filter((part) => "text" in part && !part.thought)
          .map((part) => ("text" in part ? part.text : ""))
          .join("")
      : message.content;
    const blocks: Block[] = text ? [{ type: "text", text }] : [];
    for (const call of message.toolCalls ?? []) {
      blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments });
    }
    push(message.role, blocks);
  }
  if (input.attachments.length) {
    push(
      "user",
      input.attachments.flatMap<Block>((attachment) =>
        attachment.image
          ? [
              {
                type: "image",
                source: { type: "base64", media_type: attachment.mime, data: attachment.image },
              },
            ]
          : [
              {
                type: "text",
                text: `Attached file (untrusted data): ${attachment.name}\n${attachment.text ?? ""}`,
              },
            ],
      ),
    );
  }
  // The conversation must open with the person.
  if (turns[0]?.role !== "user")
    turns.unshift({ role: "user", content: [{ type: "text", text: "Continue." }] });
  return {
    model,
    max_tokens: maxTokens,
    stream: true,
    ...(system ? { system } : {}),
    messages: turns,
    ...(input.tools.length
      ? {
          tools: input.tools.map((tool) => {
            const { $schema: _dialect, ...schema } = tool.inputSchema;
            return { name: tool.name, description: tool.description, input_schema: schema };
          }),
          ...(sent?.has("forced_call") ? { tool_choice: { type: "any" } } : {}),
        }
      : {}),
  };
}

const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** Convert the Messages event stream to the common Gemini-shaped stream. */
export function anthropicResponse(response: Response, signal: AbortSignal): Response {
  if (!response.ok || !response.body) return response;
  const encoder = new TextEncoder();
  let iterator: AsyncGenerator<string>;
  const converted = new ReadableStream<Uint8Array>({
    start() {
      iterator = (async function* () {
        let stop: string | null = null;
        let ended = false;
        let bytes = 0;
        let usage: Record<string, number> = {};
        const blocks = new Map<
          number,
          { kind: "text" | "tool"; id: string; name: string; args: string }
        >();
        for await (const data of sseData(
          response.body!,
          "Provider response was truncated.",
          signal,
        )) {
          bytes += data.length;
          if (bytes > 2_000_000) throw new Error("Provider response exceeded its limit.");
          const event: unknown = JSON.parse(data);
          if (!record(event) || typeof event.type !== "string" || ended)
            throw new Error("Invalid provider event.");
          switch (event.type) {
            case "message_start": {
              const input =
                record(event.message) && record(event.message.usage)
                  ? event.message.usage.input_tokens
                  : undefined;
              if (Number.isSafeInteger(input))
                usage = { ...usage, promptTokenCount: Number(input) };
              break;
            }
            case "content_block_start": {
              const index = Number(event.index);
              const block = event.content_block;
              if (
                !Number.isInteger(index) ||
                index < 0 ||
                index >= 64 ||
                !record(block) ||
                blocks.has(index)
              )
                throw new Error("Invalid provider block.");
              if (block.type === "text") {
                blocks.set(index, { kind: "text", id: "", name: "", args: "" });
                if (typeof block.text === "string" && block.text)
                  yield JSON.stringify({
                    candidates: [{ content: { parts: [{ text: block.text }] } }],
                  });
              } else if (block.type === "tool_use") {
                if (typeof block.id !== "string" || typeof block.name !== "string")
                  throw new Error("Invalid provider call.");
                blocks.set(index, { kind: "tool", id: block.id, name: block.name, args: "" });
              } else if (block.type === "thinking" || block.type === "redacted_thinking") {
                // Private reasoning is never retained or forwarded.
                blocks.set(index, { kind: "text", id: "thinking", name: "", args: "" });
              } else throw new Error("Unsupported provider block.");
              break;
            }
            case "content_block_delta": {
              const held = blocks.get(Number(event.index));
              const delta = event.delta;
              if (!held || !record(delta)) throw new Error("Invalid provider delta.");
              if (delta.type === "text_delta" && held.kind === "text" && held.id !== "thinking") {
                if (typeof delta.text !== "string") throw new Error("Invalid provider text.");
                if (delta.text)
                  yield JSON.stringify({
                    candidates: [{ content: { parts: [{ text: delta.text }] } }],
                  });
              } else if (delta.type === "input_json_delta" && held.kind === "tool") {
                if (typeof delta.partial_json !== "string")
                  throw new Error("Invalid provider argument.");
                held.args += delta.partial_json;
                if (held.args.length > 200_000)
                  throw new Error("Provider call exceeded its limit.");
              } else if (held.id !== "thinking") throw new Error("Invalid provider delta.");
              break;
            }
            case "content_block_stop":
            case "ping":
              break;
            case "message_delta": {
              if (record(event.delta) && event.delta.stop_reason != null) {
                const reason = String(event.delta.stop_reason);
                if (
                  ![
                    "end_turn",
                    "tool_use",
                    "max_tokens",
                    "stop_sequence",
                    "refusal",
                    "pause_turn",
                  ].includes(reason)
                )
                  throw new Error("Invalid provider terminal.");
                stop = reason;
              }
              const output = record(event.usage) ? event.usage.output_tokens : undefined;
              if (Number.isSafeInteger(output))
                usage = { ...usage, candidatesTokenCount: Number(output) };
              break;
            }
            case "message_stop":
              ended = true;
              break;
            case "error":
              throw new Error("Provider reported an error mid-answer.");
            default:
              throw new Error("Unknown provider event.");
          }
        }
        signal.throwIfAborted();
        if (!ended || !stop) throw new Error("Provider response has no terminal.");
        const parts: Record<string, unknown>[] = [];
        const ids = new Set<string>();
        if (stop === "tool_use" || stop === "end_turn") {
          for (const [, block] of [...blocks].sort(([a], [b]) => a - b)) {
            if (block.kind !== "tool") continue;
            const args: unknown = block.args ? JSON.parse(block.args) : {};
            if (
              !record(args) ||
              !block.id ||
              !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(block.name) ||
              ids.has(block.id)
            )
              throw new Error("Invalid completed provider call.");
            ids.add(block.id);
            parts.push({ functionCall: { id: block.id, name: block.name, args } });
          }
        }
        yield JSON.stringify({
          candidates: [
            {
              content: { parts },
              finishReason:
                stop === "max_tokens" ? "MAX_TOKENS" : stop === "refusal" ? "SAFETY" : "STOP",
            },
          ],
          ...(usage.promptTokenCount !== undefined || usage.candidatesTokenCount !== undefined
            ? { usageMetadata: usage }
            : {}),
        });
      })();
    },
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(`data: ${next.value}\n\n`));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await response.body?.cancel().catch(() => {});
      await iterator.return("");
    },
  });
  return new Response(converted, {
    status: response.status,
    headers: { "Content-Type": "text/event-stream" },
  });
}
