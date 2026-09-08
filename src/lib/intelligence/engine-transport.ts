import type { BrainMessage } from "@/lib/brain/adapter";
import type {
  IntelligenceEvent,
  IntelligenceRequest,
  IntelligenceTransport,
  NormalizedToolCall,
} from "./contract";

/** The existing UI engine boundary, narrowed to what a transport needs. */
export interface OcadeLocalEngine {
  send(options: {
    messages: BrainMessage[];
    onToken(chunk: string): void;
    tools?: readonly unknown[];
    onToolCall?(call: { id?: string; name: string; arguments: Record<string, unknown> }): void;
    signal?: AbortSignal;
    background?: boolean;
  }): Promise<{ ok: boolean; reason?: string; cancelled?: boolean }>;
  stop(): void;
}

/**
 * Normalize the existing local engine behind `OcadeIntelligence`.
 *
 * This is an adapter, not another router or model implementation. The engine
 * retains its one hardware-aware Brain authority; this boundary only converts
 * messages, tools, streaming and cancellation into the shared contract.
 */
export function createEngineIntelligenceTransport(engine: OcadeLocalEngine): IntelligenceTransport {
  return {
    backend: "native_local",
    async probe() {
      // The engine performs the authoritative hardware probe in `send`. Doing
      // it twice here would race first-run preparation and duplicate work.
      return {
        available: true,
        state: "ready" as const,
        capabilities: { text: true, tools: true, vision: true },
      };
    },
    async *stream(request: IntelligenceRequest): AsyncIterable<IntelligenceEvent> {
      const queued: IntelligenceEvent[] = [];
      let wake: (() => void) | null = null;
      let finished = false;
      let text = "";
      const toolCalls: NormalizedToolCall[] = [];
      const push = (event: IntelligenceEvent) => {
        queued.push(event);
        wake?.();
        wake = null;
      };

      const completion = engine
        .send({
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
            ...(message.images?.length ? { images: message.images } : {}),
          })),
          onToken(chunk) {
            text += chunk;
            push({ type: "token", text: chunk });
          },
          ...(request.tools.length
            ? {
                tools: request.tools.map((tool) => ({
                  type: "function",
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema,
                  },
                })),
                onToolCall(call: {
                  id?: string;
                  name: string;
                  arguments: Record<string, unknown>;
                }) {
                  const normalized = {
                    id: call.id ?? `${request.generationId}:tool:${toolCalls.length}`,
                    name: call.name,
                    arguments: call.arguments ?? {},
                  };
                  toolCalls.push(normalized);
                  push({ type: "tool_call", call: normalized });
                },
              }
            : {}),
          ...(request.signal ? { signal: request.signal } : {}),
          ...(request.background ? { background: true } : {}),
        })
        .catch((error: unknown) => ({
          ok: false,
          reason: error instanceof Error ? error.message : "Local Intelligence stopped.",
        }))
        .finally(() => {
          finished = true;
          wake?.();
          wake = null;
        });

      while (!finished || queued.length > 0) {
        if (queued.length === 0) {
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
          continue;
        }
        yield queued.shift()!;
      }

      const result = await completion;
      if (!result.ok) {
        const cancelled = Boolean(
          request.signal?.aborted || ("cancelled" in result && result.cancelled),
        );
        yield {
          type: "refusal",
          code: cancelled ? "cancelled" : "local_unavailable",
          reason: cancelled
            ? "Stopped by the user."
            : (result.reason ?? "Local Intelligence stopped."),
          retryable: false,
        };
        return;
      }

      yield {
        type: "final",
        response: {
          text,
          toolCalls,
          toolResults: [],
          backend: "native_local",
          stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
        },
      };
    },
    cancel() {
      engine.stop();
    },
  };
}
