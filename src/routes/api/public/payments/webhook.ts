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
import { decide, type ExistingRecord } from "@/lib/payments/webhook-apply";
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

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The subscription/transaction id an event is about, whatever its shape. */
function entityIdOf(data: any): string | null {
  return typeof data?.id === "string" ? data.id : null;
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  const supabase = getSupabase();
  const data = (event.data ?? {}) as Record<string, unknown>;
  const entityId = entityIdOf(data);

  /*
   * THE AUDIT ROW IS THE LOCK, and it is claimed BEFORE anything is applied.
   *
   * `event_id` is the table's primary key, so a retried delivery loses the
   * insert and returns here having changed nothing. Doing it first rather than
   * last is what makes it a guard instead of a log: recorded afterwards, two
   * concurrent deliveries of the same event both find no row, both apply, and
   * both then record success.
   */
  const claim = await supabase
    .from("payment_webhook_events")
    .insert({
      event_id: event.eventId,
      event_type: event.eventType,
      occurred_at: event.occurredAt,
      environment: env,
      entity_id: entityId,
      outcome: "received",
    })
    .select("event_id")
    .maybeSingle();

  if (claim.error) {
    /*
     * A duplicate key is the expected, healthy outcome of a provider retry, so
     * it is a success: the event has already been handled. Anything else is a
     * real database failure and must surface, because silently continuing
     * would apply an event OCADE cannot prove it applied.
     */
    if (claim.error.code === "23505") return;
    throw claim.error;
  }

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

  if (instruction.action === "upsert") {
    const { error } = await supabase.from("subscriptions").upsert(
      { ...instruction.row, updated_at: new Date().toISOString() },
      {
        onConflict: "paddle_subscription_id",
      },
    );
    if (error) throw error;
  } else if (instruction.action === "update") {
    const { error } = await supabase
      .from("subscriptions")
      .update({ ...instruction.patch, updated_at: new Date().toISOString() })
      .eq("paddle_subscription_id", instruction.paddleSubscriptionId)
      .eq("environment", env);
    if (error) throw error;
  }

  await supabase
    .from("payment_webhook_events")
    .update({
      outcome: instruction.action,
      reason: instruction.action === "ignore" ? instruction.reason : null,
      user_id: instruction.action === "upsert" ? instruction.row.user_id : null,
    })
    .eq("event_id", event.eventId);
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
