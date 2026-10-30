/**
 * The one door a paired JARVIS companion uses: enroll, ask for work, report
 * what it observed. Authorized only by the device's own P-256 signature; a
 * browser session here grants nothing. See `@/lib/jarvis/authority.server`.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/jarvis/device")({
  server: {
    handlers: {
      GET: () =>
        Response.json({ error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } }),
      POST: async ({ request }) => {
        const { handleDeviceRequest } = await import("@/lib/jarvis/authority.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const source = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
        const reply = await handleDeviceRequest(supabaseAdmin, request, source);
        return Response.json(reply.body, {
          status: reply.status,
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
