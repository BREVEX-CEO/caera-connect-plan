/**
 * WHETHER OCADE CAN TAKE A PAYMENT AT ALL — DECIDED ONCE, FROM CONFIGURATION.
 *
 * This replaces `FREE_LAUNCH_MODE`, a hand-set boolean that said "nobody may be
 * charged". It did that job, but it was the wrong SHAPE for the job: a constant
 * somebody has to remember to flip, guarding a payment stack whose readiness it
 * did not actually measure. Turning it off on a deployment with no provider
 * credentials would have opened a checkout that could not complete, and leaving
 * it on with credentials present would have hidden a working one.
 *
 * So availability is now derived from whether the deployment is genuinely
 * configured. It fails closed on an unconfigured deployment — which is every
 * deployment today — and it opens by itself once the configuration is real,
 * with no source change and nothing to remember.
 *
 * TWO HALVES, BOTH REQUIRED. The browser can only see its own half: the public
 * client token that opens a provider-hosted checkout. The server half — API
 * key, webhook secret, and a product id for every sellable plan — is checked
 * server-side, because those values must never reach a bundle. A surface that
 * offers checkout on the browser half alone is offering a window that opens
 * onto a payment the server cannot finish, verify, or refund.
 *
 * NOTHING HERE GRANTS ANYTHING. This module answers "may a checkout be
 * offered?". Whether an account HAS paid access is the entitlement authority's
 * question, and it is answered from server-verified provider state — never from
 * a redirect, a query parameter, or this file.
 */
import { PLANS } from "./pricing";

export interface CheckoutAvailability {
  /** Whether a checkout may be offered to a customer right now. */
  available: boolean;
  /**
   * Exactly what is missing, for an operator. Never rendered to a customer:
   * naming a deployment's absent credentials to the public is both useless to
   * them and a small disclosure. Customers get `customerNotice`.
   */
  missing: string[];
  /**
   * What a customer is told when checkout is unavailable — truthfully, and
   * without implying the plan will never exist or that they have done
   * something wrong.
   */
  customerNotice: string;
}

const UNAVAILABLE_NOTICE =
  "Paid plans are not available for purchase yet. Your account keeps working on the free plan, and nothing has been charged.";

/**
 * The browser half: can a provider-hosted checkout window be opened?
 *
 * The client token is public by design — it can open a checkout, never read or
 * change an account — which is why it is the only payment value a bundle is
 * allowed to carry.
 */
export function browserCheckoutConfigured(
  env: Record<string, string | undefined> = importMetaEnv(),
): boolean {
  return Boolean(env["VITE_PAYMENTS_CLIENT_TOKEN"]?.trim());
}

/**
 * The server half: can a payment be completed, verified and refunded?
 *
 * Every sellable plan needs a product id, because a catalogue with a gap would
 * let a customer reach a checkout for a plan the server cannot price. The
 * webhook secret is required for the same reason a lock needs a key: without
 * it, no provider event can be verified, and an unverified event must never
 * move an entitlement.
 */
export function serverCheckoutConfigured(env: Record<string, string | undefined>): string[] {
  const missing: string[] = [];

  const sandbox =
    Boolean(env["PAYMENTS_SANDBOX_API_KEY"]?.trim()) &&
    Boolean(env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"]?.trim());
  const live =
    Boolean(env["PAYMENTS_LIVE_API_KEY"]?.trim()) &&
    Boolean(env["PAYMENTS_LIVE_WEBHOOK_SECRET"]?.trim());

  /*
   * EITHER environment, not both. A sandbox-only deployment is a legitimate
   * state — it is how the payment matrix is proven before live credentials
   * exist — and requiring both would make that state indistinguishable from an
   * unconfigured one.
   */
  if (!sandbox && !live) {
    missing.push("a complete sandbox or live provider credential pair");
  }

  for (const plan of PLANS) {
    if (!plan.publiclyAvailable || plan.productIdEnv === null) continue;
    if (!env[plan.productIdEnv]?.trim()) missing.push(plan.productIdEnv);
  }

  return missing;
}

/**
 * The whole answer, for a server that can see both halves.
 *
 * `browserToken` is passed rather than read, because the server's `process.env`
 * does not necessarily carry the build-time browser value.
 */
export function checkoutAvailability(
  env: Record<string, string | undefined>,
  browserToken: string | undefined,
): CheckoutAvailability {
  const missing = serverCheckoutConfigured(env);
  if (!browserToken?.trim()) missing.push("VITE_PAYMENTS_CLIENT_TOKEN");
  return {
    available: missing.length === 0,
    missing,
    customerNotice: UNAVAILABLE_NOTICE,
  };
}

/** What a customer is told when there is nothing to buy. */
export const CHECKOUT_UNAVAILABLE_NOTICE = UNAVAILABLE_NOTICE;

/**
 * What a customer is told about the free plan while paid plans are not yet
 * purchasable. Truthful in both directions: it does not promise a paid tier is
 * coming, and it does not pretend the free allowance is unlimited.
 */
export const FREE_PLAN_NOTICE =
  "You are on the free plan. It has a fixed allowance, your work is kept, and nothing is charged.";

function importMetaEnv(): Record<string, string | undefined> {
  try {
    return import.meta.env as unknown as Record<string, string | undefined>;
  } catch {
    return {};
  }
}
