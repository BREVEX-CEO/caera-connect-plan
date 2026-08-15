export type PaymentMethodId = "upi" | "card" | "paypal";

export interface PaymentMethodReadiness {
  id: PaymentMethodId;
  label: string;
  provider: "Razorpay" | "PayPal";
  markets: string;
  status: "account_required" | "credentials_required" | "ready";
  disclosure: string;
}

/**
 * Provider-neutral checkout catalogue. No SDK or secret is loaded in the
 * browser. A server adapter may only mark a method ready after its account,
 * webhook secret and product mapping have all been verified.
 */
export const PAYMENT_METHODS: PaymentMethodReadiness[] = [
  {
    id: "upi",
    label: "UPI Intent or QR",
    provider: "Razorpay",
    markets: "India",
    status: "account_required",
    disclosure: "The UPI app handles approval. OCADE never asks for a UPI PIN.",
  },
  {
    id: "card",
    label: "Credit or debit card",
    provider: "Razorpay",
    markets: "India and provider-supported international cards",
    status: "account_required",
    disclosure: "The hosted checkout handles card data. OCADE stores only a provider reference.",
  },
  {
    id: "paypal",
    label: "PayPal",
    provider: "PayPal",
    markets: "Eligible international payments",
    status: "account_required",
    disclosure: "PayPal authentication and approval happen on PayPal's checkout.",
  },
];
