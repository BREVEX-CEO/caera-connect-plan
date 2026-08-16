/**
 * Why UPI is, or is not, offered at checkout — in words a customer can act on.
 *
 * Three very different situations used to look identical on the billing page:
 * the buyer is outside India, the provider account has not been approved for
 * UPI yet, and the catalogue is missing a rupee price. Only one of those is
 * the customer's business, and only two of them are something the operator can
 * fix. Collapsing them into "UPI unavailable" hides the fix from whoever owns
 * it, so each cause is a distinct reason with its own copy.
 *
 * This module is browser-safe: it holds the vocabulary and the plain-language
 * mapping. The probing that produces the reasons lives in the `.server`
 * sibling, because it needs provider credentials.
 */
import type { CurrencyCode } from "./pricing";

export type UpiReason =
  /** No client token on this deployment, so no checkout can open at all. */
  | "checkout_not_configured"
  /** The provider rejected our credentials for this environment. */
  | "provider_account_not_approved"
  /** No rupee price exists for a plan, so the provider cannot offer UPI. */
  | "catalogue_missing_inr_price"
  /** The buyer is not being charged in rupees. Nothing to fix — just untrue for them. */
  | "region_not_eligible";

export type UpiState =
  /** Everything we can verify says UPI should appear for this buyer. */
  | "available"
  /** Correct configuration, wrong buyer: UPI is an India/INR method. */
  | "region_not_eligible"
  /** Something the operator must fix before any Indian buyer sees UPI. */
  | "setup_required";

export interface UpiCatalogueCheck {
  priceId: string;
  planName: string;
  hasInrPrice: boolean;
  /** What the provider actually returned, for the checklist view. */
  detail: string;
}

export interface UpiReadiness {
  environment: "sandbox" | "live";
  /** The currency this buyer would be charged in. */
  currency: CurrencyCode;
  state: UpiState;
  reasons: UpiReason[];
  catalogue: UpiCatalogueCheck[];
  checkedAt: string;
}

/**
 * The one thing this system cannot prove from code.
 *
 * Whether UPI is switched on in the provider's checkout settings is not
 * exposed by their API. Guessing would be worse than saying so: a green tick
 * we cannot substantiate is exactly the kind of fake state the product forbids.
 */
export const UPI_TOGGLE_IS_NOT_MACHINE_VERIFIABLE =
  "One thing cannot be checked from here: whether UPI is switched on in the payment provider's own checkout settings. That switch is not readable through their API, so confirm it in the provider dashboard and prove it with one test payment.";

export interface ReasonCopy {
  title: string;
  body: string;
  /** Who can resolve it. Customers should never be shown operator work as their problem. */
  audience: "operator" | "customer";
}

export const UPI_REASON_COPY: Record<UpiReason, ReasonCopy> = {
  checkout_not_configured: {
    title: "Payments are not connected on this deployment",
    body: "No payment provider token is configured here, so no method can be offered — UPI included. Connect payments, then re-check this page.",
    audience: "operator",
  },
  provider_account_not_approved: {
    title: "The payment account is not approved yet",
    body: "The provider refused our credentials for this environment. Accounts must finish verification and be approved before real payments — including UPI — can be taken. Nothing in the app can shorten that review.",
    audience: "operator",
  },
  catalogue_missing_inr_price: {
    title: "Some plans have no rupee price",
    body: "UPI is only offered when the buyer is charged in Indian rupees. Any plan without an INR price will silently fall back to another currency and lose UPI at checkout.",
    audience: "operator",
  },
  region_not_eligible: {
    title: "UPI is an India-only method",
    body: "UPI works for buyers in India paying in rupees. You will be charged in your own currency, so the checkout will show cards and the other methods available where you are.",
    audience: "customer",
  },
};

/** One sentence for the top of the billing page, or null when nothing is wrong. */
export function summariseUpiReadiness(readiness: UpiReadiness): string | null {
  if (readiness.state === "available") return null;
  if (readiness.state === "region_not_eligible") {
    return `UPI is not shown for this account because your prices are charged in ${readiness.currency}, and UPI is only offered to buyers in India paying in rupees.`;
  }
  const first = readiness.reasons.find((r) => r !== "region_not_eligible");
  return first
    ? `${UPI_REASON_COPY[first].title}. ${UPI_REASON_COPY[first].body}`
    : "UPI needs setup before it can appear at checkout.";
}

/**
 * Derive the overall state from the reasons found.
 *
 * Operator problems outrank the buyer's region: if the catalogue is broken,
 * telling an Indian buyer "not your region" would be a lie, and telling the
 * operator nothing would leave the real fault invisible.
 */
export function deriveUpiState(reasons: UpiReason[]): UpiState {
  const operatorFault = reasons.some((r) => r !== "region_not_eligible");
  if (operatorFault) return "setup_required";
  if (reasons.includes("region_not_eligible")) return "region_not_eligible";
  return "available";
}
