import {
  unavailable,
  type AdapterAvailability,
  type BrainAdapter,
  type BrainMessage,
  type BrainStreamHandlers,
  type BrainStreamResult,
} from "../adapter";
import { TOKEN_LIFETIME_MS } from "../pairing";

/**
 * Borrow a paired computer's engine.
 *
 * WHAT THIS TALKS TO, AND WHAT IT REFUSES TO TALK TO. It speaks to OCADE's
 * BRIDGE on the paired machine — an authenticated endpoint that applies the
 * pairing policy before generating anything. It never speaks to the inference
 * runtime directly, and there is deliberately no way to configure it to: a
 * page that could reach a raw engine port would be an unauthenticated prompt
 * and file-reading surface on somebody's computer.
 *
 * EVERY REQUEST IS SIGNED AND SINGLE-USE. A fresh nonce and timestamp go into
 * each one, so a captured request cannot be replayed, and the bridge is the
 * one that decides — this side proves who it is and asks.
 *
 * THE SECRET NEVER TRAVELS. It signs; it is not sent. That is why the
 * signature is computed here with WebCrypto rather than handing the bridge
 * anything it could leak.
 */

export interface PairedCredentials {
  deviceId: string;
  /** Base URL of the paired machine's OCADE bridge, e.g. "https://10.0.0.4:7443". */
  bridgeUrl: string;
  /** Shared secret from approval. Used to sign; never transmitted. */
  secret: string;
}

/** Where the credentials come from. Injected so this stays testable. */
export interface PairedCredentialSource {
  current: () => PairedCredentials | null;
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class PairedDesktopAdapter implements BrainAdapter {
  readonly id = "paired_desktop" as const;
  readonly displayName = "Paired computer";

  private readonly credentials: PairedCredentialSource;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { credentials: PairedCredentialSource; fetchImpl?: typeof fetch }) {
    this.credentials = options.credentials;
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  }

  /** Build the headers that prove who this is, fresh for every request. */
  private async authHeaders(creds: PairedCredentials): Promise<Record<string, string>> {
    const issuedAt = Date.now();
    const nonce = crypto.randomUUID();
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const signature = await hmacSha256(
      creds.secret,
      `${creds.deviceId}|${origin}|${issuedAt}|${nonce}`,
    );
    return {
      "content-type": "application/json",
      "x-ocade-device": creds.deviceId,
      "x-ocade-issued-at": String(issuedAt),
      "x-ocade-nonce": nonce,
      "x-ocade-signature": signature,
    };
  }

  async probe(): Promise<AdapterAvailability> {
    const creds = this.credentials.current();
    if (!creds) {
      return unavailable("not_paired", "No computer is paired with this device yet.", [
        "pair_a_computer",
      ]);
    }

    try {
      const controller = new AbortController();
      // Short: a paired machine that cannot answer a status call promptly is
      // not one to route a conversation through.
      const timer = setTimeout(() => controller.abort(), 4000);
      const response = await this.fetchImpl(`${creds.bridgeUrl.replace(/\/+$/, "")}/status`, {
        headers: await this.authHeaders(creds),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.status === 401 || response.status === 403) {
        return unavailable(
          "not_paired",
          "That computer no longer accepts this device. Pair it again.",
          ["pair_a_computer"],
        );
      }
      if (!response.ok) {
        return unavailable("not_running", `The paired computer answered ${response.status}.`);
      }

      const body = (await response.json()) as {
        label?: string;
        modelId?: string | null;
        vision?: boolean;
        tools?: boolean;
      };
      return {
        available: true,
        label: body.label ?? "Paired computer",
        locality: "paired_device",
        modelId: body.modelId ?? null,
        capabilities: {
          text: true,
          vision: body.vision === true,
          imageGeneration: false,
          tools: body.tools === true,
        },
      };
    } catch {
      // Unreachable is the ordinary case — the laptop is asleep or on another
      // network. It is not an error state, it is a reason to use another engine.
      return unavailable("not_running", "The paired computer is not reachable right now.", [
        "pair_a_computer",
      ]);
    }
  }

  async stream(
    messages: BrainMessage[],
    handlers: BrainStreamHandlers,
  ): Promise<BrainStreamResult> {
    const creds = this.credentials.current();
    if (!creds) {
      return {
        ok: false,
        failure: "unavailable",
        reason: "No computer is paired with this device.",
      };
    }

    const startedAt = Date.now();
    let firstTokenMs: number | null = null;

    try {
      const response = await this.fetchImpl(`${creds.bridgeUrl.replace(/\/+$/, "")}/chat`, {
        method: "POST",
        headers: await this.authHeaders(creds),
        body: JSON.stringify({ messages, think: handlers.think === true }),
        signal: handlers.signal,
      });

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          failure: "unavailable",
          reason: "That computer refused this device. Pair it again.",
        };
      }
      if (response.status === 429) {
        return {
          ok: false,
          failure: "error",
          reason: "The paired computer is busy. Try again in a moment.",
        };
      }
      if (!response.ok || !response.body) {
        return {
          ok: false,
          failure: "error",
          reason: `The paired computer answered ${response.status}.`,
        };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let modelId: string | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (handlers.signal?.aborted) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          try {
            const event = JSON.parse(line) as { token?: string; modelId?: string };
            if (event.modelId) modelId = event.modelId;
            if (event.token) {
              if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
              handlers.onToken(event.token);
            }
          } catch {
            /* A partial or keep-alive line is not an error. */
          }
        }
      }

      if (handlers.signal?.aborted) {
        return { ok: false, failure: "cancelled", reason: "Stopped." };
      }
      return { ok: true, modelId, firstTokenMs };
    } catch (error) {
      if (handlers.signal?.aborted) {
        return { ok: false, failure: "cancelled", reason: "Stopped." };
      }
      return {
        ok: false,
        failure: "error",
        reason: `The paired computer stopped responding: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }
}

/**
 * The bridge contract this adapter speaks, stated once so the desktop side and
 * this side cannot drift apart silently.
 *
 * `GET  /status` → 200 { label, modelId, vision, tools }
 * `POST /chat`   → newline-delimited JSON: { token } … optionally { modelId }
 *
 * Both require the four `x-ocade-*` headers. The bridge MUST apply
 * `authorisePairedRequest` before doing any work, and MUST reject a request
 * whose `issuedAt` is older than TOKEN_LIFETIME_MS.
 */
export const PAIRED_BRIDGE_CONTRACT = {
  statusPath: "/status",
  chatPath: "/chat",
  headers: ["x-ocade-device", "x-ocade-issued-at", "x-ocade-nonce", "x-ocade-signature"] as const,
  tokenLifetimeMs: TOKEN_LIFETIME_MS,
} as const;
