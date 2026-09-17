/**
 * Offline Intelligence, behind the same contract the online boundary uses.
 *
 * ONE ADAPTER IN, ONE TRANSPORT OUT. It converts messages, streaming and
 * cancellation; it decides nothing. Which engine is running is the
 * installation authority's answer, whether the request may run at all is the
 * usage gate's, and which of the two backends serves is the router's. Two
 * transports used to sit here — one wrapping a device-mode router and one
 * wrapping a "local engine" interface — and between them there was no single
 * place that knew what was actually loaded.
 *
 * IT NEVER STARTS A DOWNLOAD. `authorityBackedAdapter` holds no engine and
 * forwards to whatever the authority has running; when nothing is running it
 * reports, in preparation language, that the device is still being prepared.
 * A transport that could prepare would be a second installer.
 */
import { authorityBackedAdapter } from "@/lib/brain/runtime-activation";
import type { BrainMessage } from "@/lib/brain/adapter";
import type {
  IntelligenceEvent,
  IntelligenceRequest,
  IntelligenceTransport,
  IntelligenceTransportStatus,
} from "./contract";

/**
 * The transcript, as the local engine takes it.
 *
 * ATTACHMENTS ARE APPENDED AS TEXT, AND IMAGES ARE NOT SENT AT ALL. The local
 * engine reads text; it cannot see. `PLAN.md` is explicit that an offline image
 * request must fail clearly rather than pretend, and the adapter refuses one —
 * so passing an image here would only move the refusal somewhere less honest.
 */
function toBrainMessages(request: IntelligenceRequest): BrainMessage[] {
  const messages: BrainMessage[] = request.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const readable = request.attachments.filter((attachment) => attachment.text);
  const last = messages[messages.length - 1];
  if (last && readable.length > 0) {
    last.content += readable
      .map(
        (attachment) =>
          `\n\n--- attached file: ${attachment.name} ---\n${attachment.text}\n--- end of ${attachment.name} ---`,
      )
      .join("");
  }
  return messages;
}

export function createOfflineIntelligenceTransport(
  adapter = authorityBackedAdapter(),
): IntelligenceTransport {
  return {
    backend: "on_device",

    async probe(): Promise<IntelligenceTransportStatus> {
      const availability = await adapter.probe();
      if (!availability.available) {
        return {
          available: false,
          state: "preparing",
          /*
           * `preparing` rather than `unavailable`, and the distinction is the
           * whole of what this state is for. The engine is not missing; it has
           * not finished being prepared, and the difference decides whether
           * Automatic waits or falls back.
           */
          reason: availability.reason,
          capabilities: { text: false, tools: false, vision: false },
        };
      }
      return {
        available: true,
        state: "ready",
        capabilities: {
          text: availability.capabilities.text,
          tools: availability.capabilities.tools,
          vision: availability.capabilities.vision,
        },
      };
    },

    async *stream(request: IntelligenceRequest): AsyncIterable<IntelligenceEvent> {
      yield { type: "status", backend: "on_device", state: "starting" };

      /*
       * The adapter streams through a callback and this contract yields. The
       * queue is the bridge: tokens are pushed as they arrive and drained by
       * the consumer, so a slow reader cannot drop a token and a fast producer
       * cannot block the engine.
       */
      const queued: string[] = [];
      let wake: (() => void) | null = null;
      let finished = false;
      let text = "";

      const push = (chunk: string) => {
        text += chunk;
        queued.push(chunk);
        wake?.();
        wake = null;
      };

      const work = adapter
        .stream(toBrainMessages(request), {
          onToken: push,
          signal: request.signal,
          think: request.thinking === true,
        })
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
        yield { type: "token", text: queued.shift()! };
      }

      const outcome = await work;

      if (!outcome.ok) {
        yield {
          type: "refusal",
          code: outcome.failure === "cancelled" ? "cancelled" : "local_unavailable",
          reason: outcome.reason,
          /*
           * A cancellation is not retryable and neither is an engine that is
           * still preparing — Automatic must not spin between the two. A real
           * error is, because the next attempt may land on a started engine.
           */
          retryable: outcome.failure === "error",
        };
        return;
      }

      if (text.length === 0) {
        yield {
          type: "refusal",
          code: "empty_response",
          reason: "OCADE produced no answer. Try again.",
          retryable: true,
        };
        return;
      }

      yield {
        type: "final",
        response: {
          text,
          toolCalls: [],
          toolResults: [],
          backend: "on_device",
          stopReason: "end_turn",
        },
      };
    },
  };
}
