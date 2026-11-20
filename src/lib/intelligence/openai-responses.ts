import {
  sseData,
  type NormalizedAttachment,
  type NormalizedMessage,
  type NormalizedToolDefinition,
} from "./contract.ts";
import type { ProviderFeature } from "./edge-handler.ts";

/**
 * THE OPENAI RESPONSES ADAPTER (plan 14D.4.3), beside Chat Completions, for providers and models
 * served only through `/responses`.
 *
 * Request: system text as `instructions`, the conversation as input items (messages, function
 * calls and their outputs), images as `input_image` data URLs, nothing stored at the provider
 * (`store: false`), a forced call as `tool_choice: "required"`. Response: the event stream is
 * converted to the common stream; calls are released only after `response.completed`, never
 * from a truncated, failed or incomplete answer, and reasoning items are never forwarded.
 */
type Item = Record<string, unknown>;

export function responsesBody(
  input: {
    messages: NormalizedMessage[];
    tools: NormalizedToolDefinition[];
    attachments: NormalizedAttachment[];
  },
  maxTokens: number,
  model: string,
  sent?: ReadonlySet<ProviderFeature>,
): Record<string, unknown> {
  const instructions = input.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const items: Item[] = [];
  for (const message of input.messages) {
    if (message.role === "system") continue;
    if (message.toolResult) {
      items.push({
        type: "function_call_output",
        call_id: message.toolResult.callId,
        output: message.content,
      });
      continue;
    }
    const text = message.parts
      ? message.parts
          .filter((part) => "text" in part && !part.thought)
          .map((part) => ("text" in part ? part.text : ""))
          .join("")
      : message.content;
    if (text) {
      items.push({
        role: message.role,
        content: [{ type: message.role === "assistant" ? "output_text" : "input_text", text }],
      });
    }
    for (const call of message.toolCalls ?? []) {
      items.push({
        type: "function_call",
        call_id: call.id,
        name: call.name,
        arguments: JSON.stringify(call.arguments),
      });
    }
  }
  if (input.attachments.length) {
    items.push({
      role: "user",
      content: input.attachments.flatMap<Item>((attachment) =>
        attachment.image
          ? [
              {
                type: "input_image",
                image_url: `data:${attachment.mime};base64,${attachment.image}`,
              },
            ]
          : [
              {
                type: "input_text",
                text: `Attached file (untrusted data): ${attachment.name}\n${attachment.text ?? ""}`,
              },
            ],
      ),
    });
  }
  return {
    model,
    stream: true,
    store: false,
    max_output_tokens: maxTokens,
    ...(instructions ? { instructions } : {}),
    input: items,
    ...(sent?.has("thinking") ? { reasoning: { effort: "medium" } } : {}),
    ...(input.tools.length
      ? {
          tools: input.tools.map((tool) => {
            const { $schema: _dialect, ...parameters } = tool.inputSchema;
            return { type: "function", name: tool.name, description: tool.description, parameters };
          }),
          ...(sent?.has("forced_call") ? { tool_choice: "required" } : {}),
        }
      : {}),
  };
}

const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** Convert the Responses event stream to the common Gemini-shaped stream. */
export function responsesResponse(response: Response, signal: AbortSignal): Response {
  if (!response.ok || !response.body) return response;
  const encoder = new TextEncoder();
  let iterator: AsyncGenerator<string>;
  const converted = new ReadableStream<Uint8Array>({
    start() {
      iterator = (async function* () {
        let terminal: "completed" | "incomplete" | null = null;
        let incompleteReason = "";
        let bytes = 0;
        let usage: Record<string, number> | undefined;
        const calls = new Map<
          string,
          { order: number; callId: string; name: string; args: string }
        >();
        for await (const data of sseData(
          response.body!,
          "Provider response was truncated.",
          signal,
        )) {
          bytes += data.length;
          if (bytes > 2_000_000) throw new Error("Provider response exceeded its limit.");
          const event: unknown = JSON.parse(data);
          if (!record(event) || typeof event.type !== "string" || terminal)
            throw new Error("Invalid provider event.");
          switch (event.type) {
            case "response.output_text.delta":
              if (typeof event.delta !== "string") throw new Error("Invalid provider text.");
              if (event.delta)
                yield JSON.stringify({
                  candidates: [{ content: { parts: [{ text: event.delta }] } }],
                });
              break;
            case "response.output_item.added": {
              const item = event.item;
              if (!record(item)) throw new Error("Invalid provider item.");
              if (item.type === "function_call") {
                if (
                  typeof item.id !== "string" ||
                  typeof item.call_id !== "string" ||
                  typeof item.name !== "string" ||
                  calls.has(item.id)
                )
                  throw new Error("Invalid provider call.");
                if (calls.size >= 32) throw new Error("Provider call exceeded its limit.");
                calls.set(item.id, {
                  order: calls.size,
                  callId: item.call_id,
                  name: item.name,
                  args: typeof item.arguments === "string" ? item.arguments : "",
                });
              }
              break;
            }
            case "response.function_call_arguments.delta": {
              const held = calls.get(String(event.item_id));
              if (!held || typeof event.delta !== "string")
                throw new Error("Invalid provider argument.");
              held.args += event.delta;
              if (held.args.length > 200_000) throw new Error("Provider call exceeded its limit.");
              break;
            }
            case "response.function_call_arguments.done": {
              const held = calls.get(String(event.item_id));
              if (!held || typeof event.arguments !== "string")
                throw new Error("Invalid provider argument.");
              held.args = event.arguments;
              break;
            }
            case "response.completed":
            case "response.incomplete": {
              terminal = event.type === "response.completed" ? "completed" : "incomplete";
              const body = record(event.response) ? event.response : {};
              if (record(body.usage)) {
                const { input_tokens: inTokens, output_tokens: outTokens } = body.usage;
                if (Number.isSafeInteger(inTokens) && Number.isSafeInteger(outTokens))
                  usage = {
                    promptTokenCount: Number(inTokens),
                    candidatesTokenCount: Number(outTokens),
                  };
              }
              if (record(body.incomplete_details))
                incompleteReason = String(body.incomplete_details.reason ?? "");
              break;
            }
            case "response.failed":
            case "error":
              throw new Error("Provider reported an error mid-answer.");
            default:
              // Lifecycle, reasoning and content-part events carry nothing to forward.
              if (!event.type.startsWith("response.")) throw new Error("Unknown provider event.");
          }
        }
        signal.throwIfAborted();
        if (!terminal) throw new Error("Provider response has no terminal.");
        const parts: Record<string, unknown>[] = [];
        const ids = new Set<string>();
        if (terminal === "completed") {
          for (const call of [...calls.values()].sort((a, b) => a.order - b.order)) {
            const args: unknown = call.args ? JSON.parse(call.args) : {};
            if (
              !record(args) ||
              !call.callId ||
              !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(call.name) ||
              ids.has(call.callId)
            )
              throw new Error("Invalid completed provider call.");
            ids.add(call.callId);
            parts.push({ functionCall: { id: call.callId, name: call.name, args } });
          }
        }
        yield JSON.stringify({
          candidates: [
            {
              content: { parts },
              finishReason:
                terminal === "completed"
                  ? "STOP"
                  : incompleteReason === "content_filter"
                    ? "SAFETY"
                    : "MAX_TOKENS",
            },
          ],
          ...(usage ? { usageMetadata: usage } : {}),
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
