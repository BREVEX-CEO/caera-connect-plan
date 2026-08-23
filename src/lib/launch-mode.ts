/**
 * FREE LAUNCH MODE.
 *
 * OCADE is free for every authenticated user for now. Rather than scatter that
 * decision through checkout hooks, banners and route guards, it lives here as
 * one flag that every surface reads.
 *
 * WHAT THIS FLAG DOES:
 *  - keeps future pricing visible as read-only information;
 *  - hides or disables checkout, upgrade and account-billing controls;
 *  - stops paid entitlement from gating any implemented feature.
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *  - it does not delete billing tables, webhook handling or provider code.
 *    Payment history is a financial record and stays exactly where it is; the
 *    Paddle implementation stays in the repository, inert, so re-enabling is a
 *    flag change rather than a rebuild.
 *  - it does not make an unavailable provider available. A missing API key, a
 *    disconnected local engine or a rate limit still fails truthfully. Free
 *    means nobody is asked to pay; it never means a capability is faked.
 */
export const FREE_LAUNCH_MODE = true;

/** True only when an operation may initialize billing or checkout. */
export function billingEnabled(): boolean {
  return !FREE_LAUNCH_MODE;
}

/**
 * Should paid entitlement gate this request?
 *
 * Server code calls this instead of testing the flag inline, so the reason a
 * subscription check was skipped is greppable.
 */
export function paidEntitlementRequired(): boolean {
  return !FREE_LAUNCH_MODE;
}

/** One sentence for any surface that has to explain the absence of pricing. */
export const FREE_LAUNCH_NOTICE =
  "OCADE is free for every signed-in account during launch. There is nothing to buy, and no plan limits your access to implemented features.";
