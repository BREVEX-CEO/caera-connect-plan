/**
 * Retired cloud-chat endpoint.
 *
 * OCADE inference is local-only. Chat generation must happen through the
 * on-device Brain adapters (desktop local runtime, browser WebGPU, or WASM).
 * This endpoint deliberately contains no provider SDK, API key, prompt body,
 * or forwarding path. It exists only as a hard fail-closed tombstone for stale
 * clients while route caches update.
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
