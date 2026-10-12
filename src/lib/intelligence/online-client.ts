import { getSupabaseBrowserConfiguration } from "@/integrations/supabase/configuration";
import type {
  IntelligenceEvent,
  IntelligenceTransport,
  IntelligenceTransportStatus,
} from "./contract";

export interface OnlineClientDependencies {
  fetch: typeof fetch;
  getAccessToken(): Promise<string | null>;
  /** A fresh token after the boundary rejected the current one; null when signed out. */
  refreshAccessToken?(): Promise<string | null>;
  configuration(): {
    url?: string;
    publishableKey?: string;
    configured: boolean;
  };
  online(): boolean;
  /** Asks the person to agree to online use; true only when they did and it was saved. */
  askConsent?(): Promise<boolean>;
}

async function browserAccessToken(): Promise<string | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function refreshedAccessToken(): Promise<string | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.auth.refreshSession();
  // A refresh that fails means this browser is signed out; say so everywhere.
  if (error || !data.session) await supabase.auth.signOut({ scope: "local" }).catch(() => null);
  return data.session?.access_token || null;
}

function defaults(): OnlineClientDependencies {
  return {
    /*
     * WRAPPED, NOT PASSED BY REFERENCE, AND THAT IS THE WHOLE BUG.
     *
     * `fetch` here was a bare reference to the global. Stored on an object and
     * called as `deps.fetch(...)`, its receiver becomes that object rather than
     * `window`, and Chromium refuses it: "Failed to execute 'fetch' on
     * 'Window': Illegal invocation". Every online request threw before it left
     * the page, the router read the throw as a transport failure, and Automatic
     * fell silently through to the on-device engine — which, on a device still
     * preparing, answered "OCADE is still preparing this device."
     *
     * So online intelligence could never work in a browser, and the failure
     * looked exactly like a device that was not ready yet. Found by pressing
     * Send in a real browser; no unit test of this module would have caught it,
     * because a test supplies its own `fetch`.
     */
    fetch: (input, init) => globalThis.fetch(input, init),
    getAccessToken: browserAccessToken,
    refreshAccessToken: refreshedAccessToken,
    // Only where the dialog is mounted (a browser); anywhere else nothing is asked or sent.
    askConsent: () => import("./online-consent-ask").then((module) => module.askOnlineConsent()),
    /*
     * NO SECOND SWITCH OVER WHETHER THE PRODUCT WORKS, AND THAT WAS THE OTHER
     * WHOLE BUG.
     *
     * This used to carry `enabled: import.meta.env
     * .VITE_OCADE_ONLINE_INTELLIGENCE === "enabled"`. Nothing set that
     * variable — not the production deployment workflow, not any document, not
     * a local `.env` — so `probe()` reported online intelligence unavailable in
     * every build that was ever shipped. Automatic fell through to the
     * on-device engine, and a device still preparing answered "OCADE is still
     * preparing this device." Pressing Send on ocade.in did that, and the
     * reported "OCADE could not verify your usage allowance" is the same
     * failure on the path where the fallback also fails.
     *
     * Availability is now exactly what it is: the project is configured and
     * this device has a connection. Whether the boundary is deployed and keyed
     * is the BOUNDARY's answer, given at request time as a sanitized refusal —
     * which is honest, rather than a build-time flag that silently decides the
     * product does not have its main feature.
     */
    configuration: getSupabaseBrowserConfiguration,
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
    backend: "online",
    async probe(): Promise<IntelligenceTransportStatus> {
      const config = deps.configuration();
      const available = config.configured && deps.online();
      return {
        available,
        state: available ? "ready" : "unavailable",
        reason: available
          ? undefined
          : config.configured
            ? "This device is offline."
            : "OCADE is not configured on this deployment.",
        capabilities: { text: available, tools: available, vision: available },
      };
    },
    async *stream(request): AsyncIterable<IntelligenceEvent> {
      const config = deps.configuration();
      if (!config.configured || !config.url || !config.publishableKey) {
        yield {
          type: "refusal",
          code: "online_unavailable",
          reason: "OCADE is not configured on this deployment.",
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

      const endpoint = `${config.url.replace(/\/$/, "")}/functions/v1/ocade-intelligence`;
      const send = (bearer: string) =>
        deps.fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${bearer}`,
            apikey: config.publishableKey!,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body,
          signal: request.signal,
        });
      const body = JSON.stringify({
        permit: request.permit,
        generationId: request.generationId,
        idempotencyKey: request.idempotencyKey,
        surface: request.surface,
        messages: request.messages,
        tools: request.tools,
        attachments: request.attachments,
        privacy: request.privacy,
        conversationId: request.conversationId,
        research: request.research === true,
      });
      let response = await send(token);
      if (response.status === 401 && deps.refreshAccessToken) {
        // An expired browser token: refresh once and send the SAME request
        // (same permit and idempotency key, so it is never charged twice).
        const fresh = await deps.refreshAccessToken();
        if (!fresh) {
          yield {
            type: "refusal",
            code: "online_unavailable",
            reason: "Sign in again to continue.",
            retryable: false,
          };
          return;
        }
        response = await send(fresh);
      }
      // Not agreed to online use: asked once, and the SAME request sent again only on
      // "I agree" (the boundary refused before claiming anything, so nothing is charged).
      if (response.status === 403) {
        const refused = (await response
          .clone()
          .json()
          .catch(() => null)) as { error?: string } | null;
        if (refused?.error === "online_not_consented") {
          if (!(await deps.askConsent?.().catch(() => false))) {
            yield {
              type: "refusal",
              code: "online_not_consented",
              reason: "Nothing was sent. Online answers need your agreement first.",
              retryable: false,
            };
            return;
          }
          response = await send((await deps.getAccessToken()) ?? token);
        }
      }

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        yield {
          type: "refusal",
          code: response.status === 429 ? "provider_rate_limited" : "online_unavailable",
          reason:
            response.status !== 429
              ? "Online Intelligence is unavailable right now."
              : request.research === true
                ? "Research is busy right now. Nothing was charged. Try again later, or turn Research off to ask without live sources."
                : "Online Intelligence is busy. Nothing was charged. Try again in a moment, or use Offline.",
          retryable,
        };
        return;
      }

      yield* readSse(response);
    },
  };
}
