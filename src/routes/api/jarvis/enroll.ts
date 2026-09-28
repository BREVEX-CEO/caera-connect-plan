/**
 * A new JARVIS device announces its own public key. Nothing is granted here:
 * the device waits until a signed-in person approves it in OCADE.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/jarvis/enroll")({
  server: {
    handlers: {
      // Only POST is part of the device protocol; anything else is not a page.
      GET: () =>
        new Response(JSON.stringify({ error: "method_not_allowed" }), {
          status: 405,
          headers: { "content-type": "application/json", allow: "POST" },
        }),
      POST: async ({ request }) => {
        const { enroll } = await import("@/jarvis/device.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { status, body } = await enroll(supabaseAdmin, request);
        return new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
