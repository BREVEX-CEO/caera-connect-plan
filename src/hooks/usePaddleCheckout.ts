import { useCallback, useState } from "react";
import { initializePaddle, getPaddlePriceId, isCheckoutConfigured } from "@/lib/paddle";

export interface OpenCheckoutOptions {
  /** Human-readable price id from the sellable-plan catalogue. */
  priceId: string;
  /** The signed-in account id. Without it a payment cannot be attributed. */
  userId: string;
  customerEmail?: string;
  successUrl?: string;
}

/**
 * Payment methods the checkout may offer, UPI included.
 *
 * The list is explicit rather than left to the default so UPI is requested on
 * every checkout. The provider still decides what is actually shown: UPI only
 * appears for a buyer in India paying in rupees, which is why the catalogue
 * carries an INR price override for India. Listing a method here can never
 * conjure it for a buyer who cannot use it — it only stops one being dropped.
 */
export const ALLOWED_PAYMENT_METHODS = [
  "upi",
  "card",
  "paypal",
  "google_pay",
  "apple_pay",
] as const;

/**
 * Opens the provider's hosted checkout.
 *
 * Card details, UPI approval and PayPal sign-in all happen on the provider's
 * surface — OCADE never sees them. The account id travels as custom data so
 * the signed webhook can attribute the purchase; a checkout without it would
 * take money that nothing could later connect to a person.
 */
export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCheckout = useCallback(async (options: OpenCheckoutOptions) => {
    setError(null);

    if (!isCheckoutConfigured()) {
      setError("Checkout is not configured on this deployment yet.");
      return;
    }
    if (!options.userId) {
      setError("Sign in before buying, so the purchase can be added to your account.");
      return;
    }

    setLoading(true);
    try {
      await initializePaddle();
      const providerPriceId = await getPaddlePriceId(options.priceId);

      window.Paddle.Checkout.open({
        items: [{ priceId: providerPriceId, quantity: 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: { userId: options.userId },
        settings: {
          displayMode: "overlay",
          variant: "one-page",
          allowLogout: false,
          allowedPaymentMethods: [...ALLOWED_PAYMENT_METHODS],
          successUrl:
            options.successUrl ?? `${window.location.origin}/checkout/success`,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The checkout could not be opened.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { openCheckout, loading, error };
}
