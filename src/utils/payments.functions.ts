/**
 * Every billing operation the browser is allowed to ask for.
 *
 * Reads are scoped to the signed-in user by RLS; nothing here can write a
 * subscription row. The only writer is the signature-verified webhook, which
 * is what makes "verified purchase state" mean something: the app believes the
 * provider, not the browser that came back from checkout.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BillingEnvironment = "sandbox" | "live";

export interface SubscriptionRecord {
  id: string;
  paddleSubscriptionId: string;
  productId: string;
  priceId: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  environment: string;
  createdAt: string | null;
}

const isEnv = (v: unknown): v is BillingEnvironment => v === "sandbox" || v === "live";

/**
 * Resolve a human-readable price id to the provider's internal id.
 *
 * Public on purpose: it exposes only catalogue information that the pricing
 * page already shows, and checkout cannot open without it.
 */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .validator((data: { priceId: string; environment: BillingEnvironment }) => {
    if (!data?.priceId || !isEnv(data.environment)) {
      throw new Error("A price id and environment are required.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { billingEnabled } = await import("@/lib/launch-mode");
    if (!billingEnabled()) {
      throw new Error("Price resolution is disabled while OCADE is in free launch mode.");
    }
    const { gatewayFetch } = await import("@/lib/paddle.server");
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = (await response.json()) as { data?: Array<{ id: string }> };
    if (!result.data?.length) {
      throw new Error(`That plan is not available for purchase yet (${data.priceId}).`);
    }
    return result.data[0]!.id;
  });

/** The signed-in account's most recent subscription in the given environment. */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { environment: BillingEnvironment }) => {
    if (!isEnv(data?.environment)) throw new Error("An environment is required.");
    return data;
  })
  .handler(async ({ data, context }): Promise<SubscriptionRecord | null> => {
    const { data: row, error } = await context.supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;

    return {
      id: row.id,
      paddleSubscriptionId: row.paddle_subscription_id,
      productId: row.product_id,
      priceId: row.price_id,
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      environment: row.environment,
      createdAt: row.created_at,
    };
  });

/**
 * A one-time link into the provider's hosted billing portal.
 *
 * Payment method changes, invoices and cancellation happen there rather than
 * in OCADE, because that keeps card details and identity checks on the
 * provider's surface where they belong.
 */
export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const { data: row, error } = await context.supabase
      .from("subscriptions")
      .select("paddle_customer_id, paddle_subscription_id, environment")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("There is no purchase on this account to manage yet.");

    const { getPaddleClient } = await import("@/lib/paddle.server");
    const paddle = getPaddleClient(row.environment === "live" ? "live" : "sandbox");
    const session = await paddle.customerPortalSessions.create(row.paddle_customer_id, [
      row.paddle_subscription_id,
    ]);

    const url =
      session.urls?.subscriptions?.[0]?.cancelSubscription ?? session.urls?.general?.overview;
    if (!url) throw new Error("The billing portal could not be opened. Try again shortly.");
    return { url };
  });

/**
 * Cancel at the end of the paid period.
 *
 * Cancelling does not take away time already paid for — access continues until
 * `current_period_end`, and the webhook writes the resulting state. Immediate
 * revocation would be taking back something the customer already bought.
 */
export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; effectiveAt: string | null }> => {
    const { data: row, error } = await context.supabase
      .from("subscriptions")
      .select("paddle_subscription_id, environment, status, current_period_end")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("There is no subscription on this account to cancel.");
    if (row.status === "canceled") {
      return { ok: true, effectiveAt: row.current_period_end };
    }

    const { getPaddleClient } = await import("@/lib/paddle.server");
    const paddle = getPaddleClient(row.environment === "live" ? "live" : "sandbox");
    await paddle.subscriptions.cancel(row.paddle_subscription_id, {
      effectiveFrom: "next_billing_period",
    });

    return { ok: true, effectiveAt: row.current_period_end };
  });
