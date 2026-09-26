/**
 * A JARVIS device exchanges a short-lived pairing code, shown to a signed-in
 * person, for its own device token. The code works once and expires in ten
 * minutes; only hashes of either are stored.
 */
import { createFileRoute } from "@tanstack/react-router";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/jarvis/pair")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { pairInput, pairDevice } = await import("@/jarvis/device.server");
        const parsed = pairInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json(400, { error: "invalid_request" });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const paired = await pairDevice(supabaseAdmin, parsed.data);
        return paired ? json(200, paired) : json(404, { error: "pairing_code_invalid" });
      },
    },
  },
});
