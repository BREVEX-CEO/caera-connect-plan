/**
 * Retired server chat endpoint.
 *
 * OCADE inference is local-only. Chat generation happens through the on-device
 * Brain adapters (desktop local runtime, browser WebGPU, or WASM). This route
 * deliberately contains no provider SDK, API key, prompt body, persistence or
 * forwarding path. It remains only as a fail-closed tombstone for stale clients.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ocade/chat")({
  server: {
    handlers: {
      POST: async () =>
        new Response(
          JSON.stringify({
            error: "local_only",
            message:
              "OCADE runs AI on this device only. No cloud chat endpoint exists; start or download the local engine.",
          }),
          {
            status: 410,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          },
        ),
    },
  },
});
