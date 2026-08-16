export type PaymentMethodId = "upi" | "card" | "paypal";

export interface PaymentMethodReadiness {
  id: PaymentMethodId;
  label: string;
  /** Who actually takes the money. One merchant of record, several methods. */
  provider: "Merchant of record checkout";
  markets: string;
  status: "account_required" | "credentials_required" | "ready";
  disclosure: string;
}

/**
 * The methods a customer can pay with, and what each one means for their data.
 *
 * There is one checkout, not one integration per method: the merchant of
 * record decides which of these to offer based on the customer's country, and
 * OCADE never loads a payment SDK or a secret in the browser. The disclosures
 * are here rather than in page copy so every surface says the same thing about
 * what OCADE can and cannot see.
 */
export const PAYMENT_METHODS: PaymentMethodReadiness[] = [
  {
    id: "upi",
    label: "UPI intent or QR",
    provider: "Merchant of record checkout",
    markets: "India",
    status: "ready",
    disclosure: "Your UPI app approves the payment. OCADE never asks for a UPI PIN.",
  },
  {
    id: "card",
    label: "Credit or debit card",
    provider: "Merchant of record checkout",
    markets: "Worldwide, subject to issuer support",
    status: "ready",
    disclosure:
      "Card details are entered on the provider's hosted checkout. OCADE stores only a provider reference.",
  },
  {
    id: "paypal",
    label: "PayPal",
    provider: "Merchant of record checkout",
    markets: "Eligible international payments",
    status: "ready",
    disclosure: "PayPal sign-in and approval happen on PayPal's own checkout.",
  },
];
