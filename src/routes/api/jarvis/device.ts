/**
 * The one door a paired JARVIS device uses: report results, receive the next
 * actions. Authorized by the device's bearer token alone.
 */
import { createFileRoute } from "@tanstack/react-router";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/jarvis/device")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const bearer = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(
          request.headers.get("authorization") ?? "",
        )?.[1];
        if (!bearer) return json(401, { error: "authentication_required" });
        const { exchangeInput, exchange } = await import("@/jarvis/device.server");
        const parsed = exchangeInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json(400, { error: "invalid_request" });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const answer = await exchange(supabaseAdmin, bearer, parsed.data);
        return answer ? json(200, answer) : json(401, { error: "device_not_paired" });
      },
    },
  },
});
