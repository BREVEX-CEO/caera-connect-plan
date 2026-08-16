import { getPaddleEnvironment, isCheckoutConfigured } from "@/lib/paddle";

/**
 * Says out loud when a purchase is not a purchase.
 *
 * The preview runs against the test environment, where a checkout looks
 * identical but no money moves. Letting that look real is the single easiest
 * way to make someone believe they have paid when they have not.
 */
export function PaymentTestModeBanner() {
  if (!isCheckoutConfigured() || getPaddleEnvironment() !== "sandbox") return null;

  return (
    <div
      role="status"
      className="rounded-lg border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-3 py-2 text-xs text-[color:var(--state-warning)]"
    >
      Test mode. Checkouts opened here use the payment provider&apos;s test environment: no card is
      charged and no real subscription is created.
    </div>
  );
}
