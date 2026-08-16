/**
 * Real verification for the internal payments checklist.
 *
 * Every step either reads the provider or reads this app's own records. None
 * of them return "pass" because a previous step passed: a checklist whose
 * steps trust each other proves nothing about the one thing that actually
 * breaks in production, which is the link between provider events and app
 * state.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { gatewayFetch, getWebhookSecret, type PaddleEnv } from "@/lib/paddle.server";
import { probeUpiReadiness } from "./upi-readiness.server";
import type { ChecklistRun, ChecklistStepResult } from "./checklist";

type Caller = SupabaseClient<Database>;

/** Admin only: these steps can move a live-adjacent subscription's billing date. */
export async function assertAdmin(supabase: Caller, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Response("Forbidden: admin role required", { status: 403 });
}

async function stepCatalogue(env: PaddleEnv): Promise<ChecklistStepResult> {
  const readiness = await probeUpiReadiness(env, "INR");
  const missing = readiness.catalogue.filter((c) => !c.hasInrPrice);
  if (readiness.reasons.includes("checkout_not_configured")) {
    return {
      id: "catalogue_inr",
      outcome: "fail",
      detail: "Payments are not connected in this environment, so the catalogue cannot be read.",
    };
  }
  if (readiness.reasons.includes("provider_account_not_approved")) {
    return {
      id: "catalogue_inr",
      outcome: "fail",
      detail: "The provider refused our credentials for this environment.",
    };
  }
  return {
    id: "catalogue_inr",
    outcome: missing.length === 0 ? "pass" : "fail",
    detail:
      missing.length === 0
        ? `All ${readiness.catalogue.length} sellable plans charge Indian buyers in rupees.`
        : `No rupee price for: ${missing.map((m) => m.priceId).join(", ")}.`,
    evidence: Object.fromEntries(readiness.catalogue.map((c) => [c.priceId, c.detail])),
  };
}

interface Destination {
  id: string;
  description?: string;
  active?: boolean;
  destination?: string;
  subscribed_events?: Array<{ name: string }>;
}

const REQUIRED_EVENTS = [
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "transaction.completed",
  "transaction.payment_failed",
];

async function stepWebhookConfigured(env: PaddleEnv): Promise<ChecklistStepResult> {
  let secretPresent = true;
  try {
    getWebhookSecret(env);
  } catch {
    secretPresent = false;
  }

  const response = await gatewayFetch(env, "/notification-settings?per_page=50");
  if (!response.ok) {
    return {
      id: "webhook_configured",
      outcome: "fail",
      detail: `Webhook destinations could not be read (provider returned ${response.status}).`,
      evidence: { signing_secret_present: secretPresent },
    };
  }
  const body = (await response.json()) as { data?: Destination[] };
  const destinations = body.data ?? [];
  const active = destinations.filter((d) => d.active !== false);
  const appEndpoint = active.find((d) => d.destination?.includes("/api/public/payments/webhook"));
  const missingEvents = appEndpoint
    ? REQUIRED_EVENTS.filter(
        (e) => !appEndpoint.subscribed_events?.some((s) => s.name === e),
      )
    : REQUIRED_EVENTS;

  if (!secretPresent || !appEndpoint) {
    return {
      id: "webhook_configured",
      outcome: "fail",
      detail: !appEndpoint
        ? "No active destination points at this app's webhook path, so provider events never reach the app."
        : "The signing secret for this environment is missing, so no event can be trusted.",
      evidence: {
        active_destinations: active.length,
        signing_secret_present: secretPresent,
      },
    };
  }

  return {
    id: "webhook_configured",
    outcome: missingEvents.length === 0 ? "pass" : "attention",
    detail:
      missingEvents.length === 0
        ? `Signing secret present and the app endpoint is subscribed to all ${REQUIRED_EVENTS.length} required events.`
        : `App endpoint found, but it is not subscribed to: ${missingEvents.join(", ")}.`,
    evidence: {
      active_destinations: active.length,
      app_destination_id: appEndpoint.id,
      signing_secret_present: true,
    },
  };
}

async function stepWebhookDelivery(
  supabase: Caller,
  userId: string,
  env: PaddleEnv,
): Promise<ChecklistStepResult> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("paddle_subscription_id, status, updated_at, price_id")
    .eq("user_id", userId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { id: "webhook_verified_delivery", outcome: "fail", detail: error.message };
  }
  if (!data) {
    return {
      id: "webhook_verified_delivery",
      outcome: "unknown",
      detail:
        "No subscription row exists for your account in this environment yet. Complete the test checkout below, then re-run: a row appearing here is the proof that a signed event was accepted.",
    };
  }
  return {
    id: "webhook_verified_delivery",
    outcome: "pass",
    detail: `A signed event was verified and written: ${data.price_id} is recorded as ${data.status}.`,
    evidence: {
      subscription_id: data.paddle_subscription_id,
      status: data.status,
      last_written: data.updated_at ?? null,
    },
  };
}

interface ProviderSubscription {
  id: string;
  status?: string;
  collection_mode?: string;
  next_billed_at?: string | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
  billing_cycle?: { interval?: string; frequency?: number };
}

async function fetchProviderSubscription(
  env: PaddleEnv,
  subscriptionId: string,
): Promise<ProviderSubscription | null> {
  const response = await gatewayFetch(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: ProviderSubscription };
  return body.data ?? null;
}

async function stepRenewal(
  supabase: Caller,
  userId: string,
  env: PaddleEnv,
): Promise<ChecklistStepResult> {
  const { data } = await supabase
    .from("subscriptions")
    .select("paddle_subscription_id, status, current_period_end")
    .eq("user_id", userId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return {
      id: "renewal_autopay",
      outcome: "unknown",
      detail: "There is no subscription on your account in this environment to renew yet.",
    };
  }

  const remote = await fetchProviderSubscription(env, data.paddle_subscription_id);
  if (!remote) {
    return {
      id: "renewal_autopay",
      outcome: "fail",
      detail:
        "This app holds a subscription the provider will not return. App state and provider state disagree.",
      evidence: { app_status: data.status },
    };
  }

  const inSync = remote.status === data.status;
  return {
    id: "renewal_autopay",
    outcome: inSync ? "pass" : "attention",
    detail: inSync
      ? `Provider and app agree: ${remote.status}. Next billing ${remote.next_billed_at ?? "not scheduled"}.`
      : `Provider says "${remote.status}" but this app recorded "${data.status}" — a renewal event has not been applied.`,
    evidence: {
      provider_status: remote.status ?? null,
      app_status: data.status,
      collection_mode: remote.collection_mode ?? null,
      next_billed_at: remote.next_billed_at ?? null,
      scheduled_change: remote.scheduled_change?.action ?? null,
    },
  };
}

/** Run every automatable step. The UPI checkout step stays manual on purpose. */
export async function runChecklist(
  supabase: Caller,
  userId: string,
  env: PaddleEnv,
): Promise<ChecklistRun> {
  const results: ChecklistStepResult[] = [];
  results.push(await stepCatalogue(env));
  results.push(await stepWebhookConfigured(env));
  results.push(await stepWebhookDelivery(supabase, userId, env));
  results.push({
    id: "upi_checkout",
    outcome: "manual",
    detail:
      "Open the test checkout in rupees and pay with a UPI test method. This is the only step that proves the provider's UPI toggle is on, because that setting is not exposed by their API.",
  });
  results.push(await stepRenewal(supabase, userId, env));

  return { environment: env, ranAt: new Date().toISOString(), results };
}

/**
 * Pull the next billing date forward so a renewal happens in minutes.
 *
 * Test environment only, and deliberately so: the same call against live money
 * would bill a real customer early. The provider requires the new date to be
 * at least 30 minutes out, hence 31.
 */
export async function fastForwardRenewal(
  supabase: Caller,
  userId: string,
  env: PaddleEnv,
): Promise<{ subscriptionId: string; nextBilledAt: string }> {
  if (env !== "sandbox") {
    throw new Response("Renewals can only be fast-forwarded in the test environment.", {
      status: 400,
    });
  }

  const { data } = await supabase
    .from("subscriptions")
    .select("paddle_subscription_id, status")
    .eq("user_id", userId)
    .eq("environment", "sandbox")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) throw new Response("No test subscription on this account to renew.", { status: 404 });
  if (data.status === "past_due") {
    throw new Response("A past-due subscription cannot have its billing date changed.", {
      status: 400,
    });
  }

  const nextBilledAt = new Date(Date.now() + 31 * 60 * 1000).toISOString();
  const response = await gatewayFetch(
    "sandbox",
    `/subscriptions/${encodeURIComponent(data.paddle_subscription_id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        next_billed_at: nextBilledAt,
        proration_billing_mode: "do_not_bill",
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Response(`The provider refused the billing date change: ${text}`, { status: 400 });
  }

  return { subscriptionId: data.paddle_subscription_id, nextBilledAt };
}
