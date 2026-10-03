/**
 * A computer with Background Mode asks OCADE to plan its task's next step
 * while the person's own OCADE is closed. Authorized only by the device's
 * signature; what is planned is queued and checked like any other action.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/jarvis/continue")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify({ error: "method_not_allowed" }), {
          status: 405,
          headers: { "content-type": "application/json", allow: "POST" },
        }),
      POST: async ({ request }) => {
        const { authenticate, PROTOCOL } = await import("@/jarvis/device.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const device = await authenticate(supabaseAdmin, request);
        if (!device.ok) {
          return json(device.status, { error: device.error, protocol: PROTOCOL.version });
        }
        const parsed = z.object({ taskId: z.string().uuid() }).safeParse(device.body);
        if (!parsed.success) return json(400, { error: "invalid_request" });
        const { carryOn } = await import("@/jarvis/background.server");
        const { serverModel } = await import("@/jarvis/background-model.server");
        return json(
          200,
          await carryOn(supabaseAdmin, device, parsed.data.taskId, { model: serverModel }),
        );
      },
    },
  },
});
