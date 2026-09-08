import type { BrainAdapter, BrainMessage } from "@/lib/brain/adapter";
import type { RouteOutcome } from "@/lib/brain/router";
import type {
  IntelligenceEvent,
  IntelligenceRequest,
  IntelligenceTransport,
  IntelligenceTransportStatus,
  NormalizedToolCall,
} from "./contract";

export interface BrainIntelligenceTransportOptions {
  route(input: { visionRequired: boolean }): Promise<RouteOutcome>;
  think?: (request: IntelligenceRequest) => boolean;
}

function backendFor(adapter: BrainAdapter): IntelligenceTransport["backend"] {
  switch (adapter.id) {
    case "browser_webgpu":
      return "webgpu_local";
    case "browser_wasm":
      return "wasm_local";
    case "paired_desktop":
      return "paired_local";
    case "desktop_bridge":
      return "ollama_local";
    case "mobile_native":
      return "native_local";
    default:
      return "native_local";
  }
}

function needsVision(request: IntelligenceRequest): boolean {
  return (
    request.attachments.some((attachment) => Boolean(attachment.image)) ||
    request.messages.some((message) => Boolean(message.images?.length))
  );
}

function toBrainMessages(request: IntelligenceRequest): BrainMessage[] {
  return request.messages.map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.images?.length ? { images: message.images } : {}),
  }));
}

/**
 * Adapts the existing Brain registry. It does not create another local model
 * implementation; WebGPU, wllama, Ollama, native and paired stay where they
 * are and are merely normalized at their shared boundary.
 */
export function createBrainIntelligenceTransport(
  options: BrainIntelligenceTransportOptions,
): IntelligenceTransport {
  let lastBackend: IntelligenceTransport["backend"] = "native_local";

  async function route(request?: IntelligenceRequest) {
    return await options.route({ visionRequired: request ? needsVision(request) : false });
  }

  return {
    get backend() {
      return lastBackend;
    },
    async probe(): Promise<IntelligenceTransportStatus> {
      const outcome = await route();
      if (!outcome.ok) {
        return {
          available: false,
          state: outcome.attempts.some((attempt) => attempt.availability.available)
            ? "preparing"
            : "unavailable",
          reason: outcome.reason,
          capabilities: { text: false, tools: false, vision: false },
        };
      }
      lastBackend = backendFor(outcome.adapter);
      return {
        available: true,
        state: "ready",
        capabilities: {
          text: outcome.availability.capabilities.text,
          tools: outcome.availability.capabilities.tools,
          vision: outcome.availability.capabilities.vision,
        },
      };
    },
    async *stream(request): AsyncIterable<IntelligenceEvent> {
      const outcome = await route(request);
      if (!outcome.ok) {
        yield {
          type: "refusal",
          code: "local_unavailable",
          reason: outcome.reason,
          retryable: false,
        };
        return;
      }
      lastBackend = backendFor(outcome.adapter);
      yield { type: "status", backend: lastBackend, state: "generating" };

      const queued: IntelligenceEvent[] = [];
      let wake: (() => void) | null = null;
      let complete = false;
      let answer = "";
      const toolCalls: NormalizedToolCall[] = [];
      const push = (event: IntelligenceEvent) => {
        queued.push(event);
        wake?.();
        wake = null;
      };

      const completion = outcome.adapter
        .stream(toBrainMessages(request), {
          signal: request.signal,
          think: options.think?.(request) ?? false,
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
              }
            : {}),
          onToken: (text) => {
            answer += text;
            push({ type: "token", text });
          },
          onToolCall: (call) => {
            const normalized = {
              id: call.id ?? `${request.generationId}:tool:${toolCalls.length}`,
              name: call.name,
              arguments: call.arguments,
            };
            toolCalls.push(normalized);
            push({ type: "tool_call", call: normalized });
          },
        })
        .catch((error: unknown) => {
          return {
            ok: false,
            failure: "error" as const,
            reason: error instanceof Error ? error.message : "Local Intelligence stopped.",
          };
        })
        .finally(() => {
          complete = true;
          wake?.();
          wake = null;
        });

      while (!complete || queued.length > 0) {
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
        const cancelled = request.signal?.aborted || result?.failure === "cancelled";
        yield {
          type: "refusal",
          code: cancelled ? "cancelled" : "local_unavailable",
          reason: cancelled
            ? "Stopped by the user."
            : (result?.reason ?? "Local Intelligence returned no response."),
          retryable: false,
        };
        return;
      }

      yield {
        type: "final",
        response: {
          text: answer,
          toolCalls,
          toolResults: [],
          backend: lastBackend,
          stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
        },
      };
    },
  };
}
