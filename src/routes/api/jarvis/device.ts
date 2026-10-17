/**
 * The one door an enrolled JARVIS device uses: report results, receive the
 * next actions, rotate its key. Authorized only by the device's signature.
 */
import { createFileRoute } from "@tanstack/react-router";

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export const Route = createFileRoute("/api/jarvis/device")({
  server: {
    handlers: {
      // Only POST is part of the device protocol; anything else is not a page.
      GET: () =>
        Response.json({ error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } }),
      POST: async ({ request }) => {
        const { authenticate, exchangeInput, exchange, PROTOCOL } =
          await import("@/jarvis/device.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const device = await authenticate(supabaseAdmin, request);
        if (!device.ok) {
          return json(device.status, { error: device.error, protocol: PROTOCOL.version });
        }
        const parsed = exchangeInput.safeParse(device.body);
        if (!parsed.success) return json(400, { error: "invalid_request" });
        return json(200, await exchange(supabaseAdmin, device, parsed.data));
      },
    },
  },
});
