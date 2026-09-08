import { getSupabaseBrowserConfiguration } from "@/integrations/supabase/configuration";
import type {
  IntelligenceEvent,
  IntelligenceRequest,
  IntelligenceTransport,
  IntelligenceTransportStatus,
} from "./contract";

export interface OnlineClientDependencies {
  fetch: typeof fetch;
  getAccessToken(): Promise<string | null>;
  configuration(): {
    url?: string;
    publishableKey?: string;
    configured: boolean;
    enabled?: boolean;
  };
  online(): boolean;
}

async function browserAccessToken(): Promise<string | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function defaults(): OnlineClientDependencies {
  return {
    fetch,
    getAccessToken: browserAccessToken,
    configuration: () => ({
      ...getSupabaseBrowserConfiguration(),
      enabled: import.meta.env.VITE_OCADE_ONLINE_INTELLIGENCE === "enabled",
    }),
    online: () => typeof navigator === "undefined" || navigator.onLine,
  };
}

function isEvent(value: unknown): value is IntelligenceEvent {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return ["status", "token", "tool_call", "tool_result", "usage", "refusal", "final"].includes(
    String(type),
  );
}

function nextSseBoundary(buffer: string): { index: number; length: number } | null {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf < 0 && crlf < 0) return null;
  if (crlf >= 0 && (lf < 0 || crlf < lf)) return { index: crlf, length: 4 };
  return { index: lf, length: 2 };
}

async function* readSse(response: Response): AsyncIterable<IntelligenceEvent> {
  if (!response.body) throw new Error("Online Intelligence returned no response body.");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let boundary = nextSseBoundary(buffer);
      while (boundary) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        for (const line of frame.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(payload);
          } catch {
            throw new Error("Online Intelligence returned a malformed stream event.");
          }
          if (!isEvent(parsed)) throw new Error("Online Intelligence returned an unknown event.");
          yield parsed;
        }
        boundary = nextSseBoundary(buffer);
      }
    }
    if (buffer.trim())
      throw new Error("Online Intelligence ended with an incomplete stream event.");
  } finally {
    reader.releaseLock();
  }
}

/** Browser transport to the authenticated Supabase Edge boundary. */
export function createOnlineIntelligenceTransport(
  overrides: Partial<OnlineClientDependencies> = {},
): IntelligenceTransport {
  const deps = { ...defaults(), ...overrides };
  return {
    backend: "gemini_online",
    async probe(): Promise<IntelligenceTransportStatus> {
      const config = deps.configuration();
      const available = config.configured && config.enabled === true && deps.online();
      return {
        available,
        state: available ? "ready" : "unavailable",
        reason: available
          ? undefined
          : config.configured && config.enabled === true
            ? "This device is offline."
            : "Online Intelligence is not active in this build.",
        capabilities: { text: available, tools: available, vision: available },
      };
    },
    async *stream(request): AsyncIterable<IntelligenceEvent> {
      const config = deps.configuration();
      if (!config.configured || config.enabled !== true || !config.url || !config.publishableKey) {
        yield {
          type: "refusal",
          code: "online_unavailable",
          reason: "Online Intelligence is not active in this build.",
          retryable: true,
        };
        return;
      }
      const token = await deps.getAccessToken();
      if (!token) {
        yield {
          type: "refusal",
          code: "online_unavailable",
          reason: "Sign in again before using Online Intelligence.",
          retryable: false,
        };
        return;
      }

      const response = await deps.fetch(
        `${config.url.replace(/\/$/, "")}/functions/v1/ocade-intelligence`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: config.publishableKey,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            permit: request.permit,
            generationId: request.generationId,
            idempotencyKey: request.idempotencyKey,
            surface: request.surface,
            messages: request.messages,
            tools: request.tools,
            attachments: request.attachments,
            privacy: request.privacy,
            projectId: request.projectId,
            conversationId: request.conversationId,
            taskId: request.taskId,
          }),
          signal: request.signal,
        },
      );

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        yield {
          type: "refusal",
          code: response.status === 429 ? "provider_rate_limited" : "online_unavailable",
          reason:
            response.status === 429
              ? "Online Intelligence is busy. OCADE can continue locally when Local Intelligence is ready."
              : "Online Intelligence is unavailable right now.",
          retryable,
        };
        return;
      }

      yield* readSse(response);
    },
  };
}
