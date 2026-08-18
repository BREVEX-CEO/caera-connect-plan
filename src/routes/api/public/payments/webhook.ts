/**
 * Signed payment-provider webhook.
 *
 * Free launch does not create new checkouts, but historical provider events may
 * still arrive. A verified event is acknowledged with 200 ONLY after its
 * database effect succeeds. Processing failures return 500 so the provider can
 * retry instead of silently losing subscription state.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, isPaddleEnv, type PaddleEnv, type VerifiedPaddleEvent } from "@/lib/paddle.server";
import type { Database } from "@/integrations/supabase/types";

let cached: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!cached) {
    const url = process.env["SUPABASE_URL"];
    const serviceRole = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !serviceRole) throw new Error("Supabase webhook storage is not configured");
    cached = createClient<Database>(url, serviceRole);
  }
  return cached;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const {
    id,
    customerId,
    customer_id,
    items,
    status,
    currentBillingPeriod,
    current_billing_period,
    customData,
    custom_data,
  } = data ?? {};

  const userId = customData?.userId ?? custom_data?.userId ?? custom_data?.user_id;
  if (!id || !userId) {
    throw new Error("Verified subscription.created event is missing subscription id or userId");
  }

  const item = items?.[0];
  const price = item?.price;
  const product = item?.product ?? price?.product;
  const priceId = price?.importMeta?.externalId ?? price?.import_meta?.external_id;
  const productId = product?.importMeta?.externalId ?? product?.import_meta?.external_id;
  if (!priceId || !productId) {
    throw new Error("Verified subscription.created event is missing stable product/price external ids");
  }

  const period = currentBillingPeriod ?? current_billing_period;
  const { error } = await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        paddle_subscription_id: id,
        paddle_customer_id: customerId ?? customer_id,
        product_id: productId,
        price_id: priceId,
        status,
        current_period_start: period?.startsAt ?? period?.starts_at ?? null,
        current_period_end: period?.endsAt ?? period?.ends_at ?? null,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    );
  if (error) throw new Error(`Could not persist subscription.created: ${error.message}`);
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, current_billing_period, scheduledChange, scheduled_change } =
    data ?? {};
  if (!id) throw new Error("Verified subscription.updated event is missing subscription id");
  const period = currentBillingPeriod ?? current_billing_period;
  const change = scheduledChange ?? scheduled_change;

  const { data: changed, error } = await getSupabase()
    .from("subscriptions")
    .update({
      status,
      current_period_start: period?.startsAt ?? period?.starts_at ?? null,
      current_period_end: period?.endsAt ?? period?.ends_at ?? null,
      cancel_at_period_end: change?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not persist subscription.updated: ${error.message}`);
  if (!changed) {
    throw new Error("subscription.updated arrived before the subscription row exists; retry required");
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  if (!data?.id) throw new Error("Verified subscription.canceled event is missing subscription id");
  const { data: changed, error } = await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not persist subscription.canceled: ${error.message}`);
  if (!changed) {
    throw new Error("subscription.canceled arrived before the subscription row exists; retry required");
  }
}

async function handleVerifiedEvent(event: VerifiedPaddleEvent, env: PaddleEnv) {
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    default:
      // Unknown signed events are intentionally acknowledged: they have no
      // declared state transition in this application and retrying cannot help.
      console.log("Unhandled payment event:", event.eventType);
  }
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

        let event: VerifiedPaddleEvent;
        try {
          event = await verifyWebhook(request, requestedEnv);
        } catch (error) {
          console.warn("Rejected payment webhook:", error);
          return new Response("Invalid webhook", { status: 400 });
        }

        try {
          await handleVerifiedEvent(event, requestedEnv);
          return Response.json({ received: true });
        } catch (error) {
          console.error("Verified payment webhook could not be persisted:", error);
          return new Response("Webhook processing failed; retry", { status: 500 });
        }
      },
    },
  },
});
