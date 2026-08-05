import { createFileRoute } from "@tanstack/react-router";

/**
 * The paired-computer bridge, as an HTTP endpoint.
 *
 * This is the transport `bridge-server.ts` deliberately does not contain: it
 * turns a `Request` into the shape the policy expects, hands it over, and turns
 * the decision back into a `Response`. Every rule about who may ask — signature,
 * origin, expiry, replay, rate limit — lives in the policy, not here, so this
 * file cannot accidentally become a second, weaker gate.
 *
 * IT DOES NOT EXIST UNLESS THE MACHINE SAYS SO. `serveBridgeRequest` returns
 * null when `OCADE_BRIDGE_ENABLED` is unset, and that becomes a 404. On OCADE's
 * hosted deployment the flag is never set, so the cloud can never answer as
 * though it were somebody's own computer — which is the entire point of a
 * paired device.
 *
 * THE ENGINE PORT IS STILL NOT REACHABLE. This endpoint speaks to the loopback
 * runtime on the user's behalf after authorising them; it never forwards a raw
 * request, never accepts an engine URL from the caller, and never returns one.
 */

const SIGNED_HEADERS = [
  "content-type",
  "x-ocade-device",
  "x-ocade-issued-at",
  "x-ocade-nonce",
  "x-ocade-signature",
].join(", ");

/**
 * CORS for approved origins only.
 *
 * A paired browser is by definition on another origin, so some allowance is
 * required — but `*` here would let any page on the internet read this
 * machine's answers. The echo is only ever of an origin a human already
 * approved at this computer.
 */
async function corsHeaders(origin: string | null): Promise<Record<string, string>> {
  if (!origin) return {};
  const { approvedOrigins } = await import("@/lib/brain/bridge-host.server");
  const allowed = await approvedOrigins();
  if (!allowed.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": SIGNED_HEADERS,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "600",
    vary: "origin",
  };
}

function headerRecord(request: Request): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

async function serve(request: Request, splat: string | undefined): Promise<Response> {
  const origin = request.headers.get("origin");
  const cors = await corsHeaders(origin);
  const { serveBridgeRequest } = await import("@/lib/brain/bridge-host.server");

  let body: unknown;
  if (request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "bad_json", message: "Unreadable request." }), {
        status: 400,
        headers: { "content-type": "application/json", ...cors },
      });
    }
  }

  const outcome = await serveBridgeRequest({
    path: `/${splat ?? ""}`,
    method: request.method,
    headers: headerRecord(request),
    body,
  });

  if (outcome === null) {
    // Not "forbidden" — absent. A disabled bridge advertises nothing.
    return new Response("Not found", { status: 404 });
  }

  if ("stream" in outcome && outcome.stream) {
    const write = outcome.stream;
    const encoder = new TextEncoder();
    const controllerRef = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          await write((line) => controller.enqueue(encoder.encode(line)), controllerRef.signal);
        } catch (error) {
          // The status line is long gone by now, so a failure has to be said
          // inside the stream or the reader sees a truncated answer and no
          // reason for it.
          const reason = error instanceof Error ? error.message : "The engine stopped.";
          controller.enqueue(encoder.encode(`${JSON.stringify({ error: reason })}\n`));
        } finally {
          controller.close();
        }
      },
      cancel() {
        controllerRef.abort();
      },
    });
    return new Response(stream, {
      status: outcome.status,
      headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", ...cors },
    });
  }

  return new Response(JSON.stringify(outcome.body ?? null), {
    status: outcome.status,
    headers: { "content-type": "application/json", ...cors },
  });
}

export const Route = createFileRoute("/api/ocade/bridge/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => serve(request, (params as { _splat?: string })._splat),
      POST: ({ request, params }) => serve(request, (params as { _splat?: string })._splat),
      OPTIONS: async ({ request }) => {
        const cors = await corsHeaders(request.headers.get("origin"));
        // No approval, no preflight: an unapproved origin gets nothing it could
        // use to decide this endpoint is worth probing further.
        if (Object.keys(cors).length === 0) return new Response(null, { status: 404 });
        return new Response(null, { status: 204, headers: cors });
      },
    },
  },
});
