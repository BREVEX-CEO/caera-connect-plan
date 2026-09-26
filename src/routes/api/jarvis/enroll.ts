/**
 * A new JARVIS device announces its own public key. Nothing is granted here:
 * the device waits until a signed-in person approves it in OCADE.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/jarvis/enroll")({
  server: {
    handlers: {
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
