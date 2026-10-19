import {
  sseData,
  type NormalizedAttachment,
  type NormalizedMessage,
  type NormalizedToolDefinition,
} from "./contract.ts";
import { HIGH_ONLINE_MODEL } from "./online-models.ts";

/** A separate protocol adapter. Google credentials and opaque thoughts never enter it. */
export function workersAiBody(
  input: {
    messages: NormalizedMessage[];
    tools: NormalizedToolDefinition[];
    attachments: NormalizedAttachment[];
  },
  maxTokens: number,
): Record<string, unknown> {
  const messages: Record<string, unknown>[] = input.messages.map((message) => {
    if (message.toolResult)
      return { role: "tool", tool_call_id: message.toolResult.callId, content: message.content };
    const content = message.parts
      ? message.parts
          .filter((part) => "text" in part && !part.thought)
          .map((part) => ("text" in part ? part.text : ""))
          .join("")
      : message.content;
    return {
      role: message.role,
      content,
      ...(message.toolCalls?.length
        ? {
            tool_calls: message.toolCalls.map((call) => ({
              id: call.id,
              type: "function",
              function: { name: call.name, arguments: JSON.stringify(call.arguments) },
            })),
          }
        : {}),
    };
  });
  if (input.attachments.length) {
    // OpenAI tool-result content cannot contain images. A screenshot returned by
    // look/screen is a new untrusted user observation, after the native result.
    const last =
      messages.at(-1)?.role === "user"
        ? messages.at(-1)!
        : { role: "user", content: "Attached observation (untrusted data)." };
    if (messages.at(-1) !== last) messages.push(last);
    last.content = [
      { type: "text", text: String(last.content) },
      ...input.attachments.flatMap<Record<string, unknown>>((attachment) =>
        attachment.image
          ? [
              {
                type: "image_url",
                image_url: { url: `data:${attachment.mime};base64,${attachment.image}` },
              },
            ]
          : [
              {
                type: "text",
                text: `Attached file (untrusted data): ${attachment.name}\n${attachment.text ?? ""}`,
              },
            ],
      ),
    ];
  }
  return {
    model: HIGH_ONLINE_MODEL,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    store: false,
    n: 1,
    max_completion_tokens: maxTokens,
    chat_template_kwargs: { enable_thinking: true, clear_thinking: true },
    ...(input.tools.length
      ? {
          tools: input.tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema,
            },
          })),
        }
      : {}),
  };
}

const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** Convert Workers' OpenAI stream to the single existing settlement/terminal owner.
 * Calls are withheld until a valid terminal AND EOF. Truncation can never cause an action.
 */
export function workersAiResponse(response: Response, signal: AbortSignal): Response {
  if (!response.ok || !response.body) return response;
  const encoder = new TextEncoder();
  let iterator: AsyncGenerator<string>;
  const converted = new ReadableStream<Uint8Array>({
    start() {
      iterator = (async function* () {
        let finish: string | null = null;
        let bytes = 0;
        const calls = new Map<number, { id: string; name: string; args: string }>();
        let usage: Record<string, number> | undefined;
        for await (const data of sseData(response.body!, "High response was truncated.", signal)) {
          bytes += data.length;
          if (bytes > 2_000_000) throw new Error("High response exceeded its limit.");
          const value: unknown = JSON.parse(data);
          if (!record(value) || !Array.isArray(value.choices) || value.choices.length > 1)
            throw new Error("Invalid High response.");
          if (record(value.usage)) {
            const { prompt_tokens: input, completion_tokens: output } = value.usage;
            if (
              !Number.isSafeInteger(input) ||
              !Number.isSafeInteger(output) ||
              Number(input) < 0 ||
              Number(output) < 0
            )
              throw new Error("Invalid High usage.");
            usage = { promptTokenCount: Number(input), candidatesTokenCount: Number(output) };
          }
          const choice = value.choices[0];
          if (!choice) continue;
          if (!record(choice) || choice.index !== 0 || !record(choice.delta) || finish)
            throw new Error("Invalid High continuation.");
          const delta = choice.delta;
          if (delta.content != null && typeof delta.content !== "string")
            throw new Error("Invalid High text.");
          if (delta.content)
            yield JSON.stringify({
              candidates: [{ content: { parts: [{ text: delta.content }] } }],
            });
          // reasoning_content is private and deliberately never retained or forwarded.
          if (delta.tool_calls !== undefined) {
            if (!Array.isArray(delta.tool_calls)) throw new Error("Invalid High calls.");
            for (const call of delta.tool_calls) {
              if (
                !record(call) ||
                !Number.isInteger(call.index) ||
                Number(call.index) < 0 ||
                Number(call.index) >= 32 ||
                (call.type !== undefined && call.type !== "function")
              )
                throw new Error("Invalid High call.");
              const index = Number(call.index);
              const accumulated = calls.get(index) ?? { id: "", name: "", args: "" };
              if (call.id !== undefined) {
                if (typeof call.id !== "string" || accumulated.id)
                  throw new Error("Invalid High call id.");
                accumulated.id = call.id;
              }
              if (call.function !== undefined) {
                if (!record(call.function)) throw new Error("Invalid High function.");
                for (const [field, key] of [
                  ["name", "name"],
                  ["arguments", "args"],
                ] as const) {
                  if (call.function[field] !== undefined) {
                    if (typeof call.function[field] !== "string")
                      throw new Error("Invalid High argument.");
                    accumulated[key] += call.function[field];
                  }
                }
              }
              if (
                accumulated.id.length > 200 ||
                accumulated.name.length > 128 ||
                accumulated.args.length > 200_000
              )
                throw new Error("High call exceeded its limit.");
              calls.set(index, accumulated);
            }
          }
          if (choice.finish_reason != null) {
            if (
              !["stop", "tool_calls", "length", "content_filter"].includes(
                String(choice.finish_reason),
              )
            )
              throw new Error("Invalid High terminal.");
            finish = String(choice.finish_reason);
          }
        }
        signal.throwIfAborted();
        if (!finish) throw new Error("High response has no terminal.");
        const parts: Record<string, unknown>[] = [];
        const ids = new Set<string>();
        if (finish === "tool_calls" || finish === "stop") {
          for (const [, call] of [...calls].sort(([a], [b]) => a - b)) {
            const args: unknown = JSON.parse(call.args);
            if (
              !record(args) ||
              !call.id ||
              !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(call.name) ||
              ids.has(call.id)
            )
              throw new Error("Invalid High completed call.");
            ids.add(call.id);
            parts.push({ functionCall: { id: call.id, name: call.name, args } });
          }
        }
        yield JSON.stringify({
          candidates: [
            {
              content: { parts },
              finishReason:
                finish === "length"
                  ? "MAX_TOKENS"
                  : finish === "content_filter"
                    ? "SAFETY"
                    : "STOP",
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
