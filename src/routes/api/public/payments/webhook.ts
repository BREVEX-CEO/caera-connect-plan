/**
 * The only writer of subscription state.
 *
 * This endpoint is deliberately unauthenticated — the payment provider has no
 * OCADE session — so the signature check in `verifyWebhook` is the whole
 * security boundary. Nothing in the body is trusted before it passes.
 *
 * It always answers 200 once a verified event has been handled, because a
 * provider that receives an error retries for days and eventually drops the
 * event, and a dropped event is a customer whose historical provider state
 * diverges from OCADE's audit record.
 *
 * WHAT THIS FILE NO LONGER DECIDES. It used to hold the mapping from event to
 * database row inline, three times, with no idempotency, no ordering and no
 * record that anything had happened — and with no handler at all for the event
 * a one-time purchase actually arrives on, so the 8-day pass in the sellable
 * catalogue could take money and create nothing. All of that judgement now
 * lives in `payments/webhook-apply.ts`, which is pure and therefore testable
 * against duplicates, stale deliveries and refunds without a database. This
 * file does three things: verify, record, apply.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, isPaddleEnv, type PaddleEnv } from "@/lib/paddle.server";
import { decide, targetEntityIdOf, type ExistingRecord } from "@/lib/payments/webhook-apply";
import type { Database } from "@/integrations/supabase/types";

let cached: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!cached) {
    cached = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return cached;
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  const supabase = getSupabase();
  const data = (event.data ?? {}) as Record<string, unknown>;
  const entityId = targetEntityIdOf(event.eventType, data);

  let existing: ExistingRecord | null = null;
  if (entityId) {
    const { data: row } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id, status, provider_event_at, environment")
      .eq("paddle_subscription_id", entityId)
      .maybeSingle();
    if (row) {
      existing = {
        paddleSubscriptionId: row.paddle_subscription_id,
        status: row.status,
        providerEventAt: row.provider_event_at,
        environment: row.environment,
      };
    }
  }

  const instruction = decide(
    {
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      environment: env,
      data,
    },
    existing,
  );

  /*
   * ONE RPC, ONE DATABASE TRANSACTION. The old three-call sequence could crash
   * after claiming an event but before changing access; every retry then saw a
   * duplicate claim and the customer stayed permanently out of sync. The RPC
   * inserts the idempotency row and changes entitlement state atomically, and
   * repeats the stale/terminal guards under the database lock.
   */
  const row = instruction.action === "upsert" ? instruction.row : null;
  const patch = instruction.action === "update" ? instruction.patch : null;
  const adjustmentAction = typeof data["action"] === "string" ? data["action"] : "";
  const { error } = await supabase.rpc("apply_payment_webhook_event", {
    p_event_id: event.eventId,
    p_event_type: event.eventType,
    p_occurred_at: event.occurredAt,
    p_environment: env,
    p_entity_id: entityId,
    p_action: instruction.action,
    p_reason: instruction.action === "ignore" ? instruction.reason : null,
    p_user_id: row?.user_id ?? null,
    p_paddle_subscription_id:
      row?.paddle_subscription_id ??
      (instruction.action === "update" ? instruction.paddleSubscriptionId : null),
    p_paddle_customer_id: row?.paddle_customer_id ?? null,
    p_product_id: row?.product_id ?? null,
    p_price_id: row?.price_id ?? null,
    p_status: row?.status ?? patch?.status ?? null,
    p_current_period_start: row?.current_period_start ?? patch?.current_period_start ?? null,
    p_current_period_end: row?.current_period_end ?? patch?.current_period_end ?? null,
    p_cancel_at_period_end: row?.cancel_at_period_end ?? patch?.cancel_at_period_end ?? null,
    p_kind: row?.kind ?? null,
    p_allow_terminal_reversal:
      adjustmentAction === "chargeback_reverse" ||
      adjustmentAction === "chargeback_warning_reverse",
  });
  if (error) throw error;
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const requestedEnv = url.searchParams.get("env") ?? "sandbox";
        if (!isPaddleEnv(requestedEnv)) {
          return new Response("Invalid payment environment", { status: 400 });
        }

        try {
          await handleWebhook(request, requestedEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Payment webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
