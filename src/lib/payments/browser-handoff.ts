import type { PlanId } from "./pricing";

export type BillingHandoffSource = "web" | "desktop" | "mobile";

/**
 * Build the provider-neutral browser handoff used by native OCADE shells.
 * Entitlement is never accepted from this URL; only a verified payment webhook
 * may update the account, after which the native app refreshes billing state.
 */
export function buildBillingHandoffUrl(input: {
  origin: string;
  source: BillingHandoffSource;
  plan?: PlanId;
}): string {
  const base = new URL("/pricing", input.origin);
  base.searchParams.set("source", input.source);
  if (input.plan) base.searchParams.set("plan", input.plan);
  return base.toString();
}

export function billingHandoffMessage(source: BillingHandoffSource | undefined): string | null {
  if (source === "desktop") {
    return "You came from the OCADE desktop app. Complete payment only on the provider-hosted page, then return to the app and refresh Billing. Access changes only after the server verifies the payment.";
  }
  if (source === "mobile") {
    return "You came from the OCADE mobile app. Complete payment in this browser, then return to the app and refresh Billing after verification.";
  }
  return null;
}
