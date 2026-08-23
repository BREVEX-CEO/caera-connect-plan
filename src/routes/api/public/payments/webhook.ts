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
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, isPaddleEnv, type PaddleEnv } from "@/lib/paddle.server";
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
  } = data;

  const userId = customData?.userId ?? custom_data?.userId ?? custom_data?.user_id;
  if (!userId) {
    console.error("Subscription webhook without a userId in customData; skipping.");
    return;
  }

  const item = items?.[0];
  const price = item?.price;
  const product = item?.product ?? price?.product;
  const priceId = price?.importMeta?.externalId ?? price?.import_meta?.external_id;
  const productId = product?.importMeta?.externalId ?? product?.import_meta?.external_id;
  if (!priceId || !productId) {
    // Raw provider ids differ between test and live, so storing them would
    // silently break plan attribution after publish. Storing nothing is safer.
    console.warn("Skipping subscription: missing importMeta.externalId", {
      rawPriceId: price?.id,
      rawProductId: product?.id,
    });
    return;
  }

  const period = currentBillingPeriod ?? current_billing_period;
  await getSupabase()
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
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const {
    id,
    status,
    currentBillingPeriod,
    current_billing_period,
    scheduledChange,
    scheduled_change,
  } = data;
  const period = currentBillingPeriod ?? current_billing_period;
  const change = scheduledChange ?? scheduled_change;

  await getSupabase()
    .from("subscriptions")
    .update({
      status,
      current_period_start: period?.startsAt ?? period?.starts_at ?? null,
      current_period_end: period?.endsAt ?? period?.ends_at ?? null,
      cancel_at_period_end: change?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

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
