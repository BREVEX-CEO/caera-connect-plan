/**
 * Browser-side checkout bootstrap.
 *
 * The client token is public by design: it can open a checkout, never read or
 * change an account. Which environment the app is in is derived from the token
 * prefix rather than a separate flag, so the preview cannot claim to be live
 * and a published build cannot silently stay in test.
 *
 * Availability is enforced here, below every checkout UI, so stale links,
 * admin surfaces and accidental callers fail closed rather than merely hiding
 * their buttons. It is DERIVED from whether the deployment is configured, not
 * from a flag somebody has to remember to set.
 */
import { browserCheckoutConfigured } from "@/lib/payments/checkout-availability";
import { resolvePaddlePrice } from "@/utils/payments.functions";

const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

/**
 * The provider script defines its own shape at runtime. Only the surface OCADE
 * actually calls is declared here, so a typo in a call site is a build error
 * rather than a checkout that fails in front of a paying customer.
 */
export interface PaddleCheckoutOpenOptions {
  items: { priceId: string; quantity: number }[];
  customer?: { email: string } | undefined;
  customData?: Record<string, string>;
  settings?: {
    displayMode?: "overlay" | "inline";
    variant?: "one-page" | "multi-page";
    allowLogout?: boolean;
    allowedPaymentMethods?: readonly string[];
    successUrl?: string;
  };
}

export interface PaddleGlobal {
  Environment: { set(environment: "sandbox" | "production"): void };
  Initialize(options: { token: string }): void;
  Checkout: { open(options: PaddleCheckoutOpenOptions): void };
}

declare global {
  interface Window {
    Paddle: PaddleGlobal;
  }
}

export type CheckoutEnvironment = "sandbox" | "live";

export function getPaddleEnvironment(): CheckoutEnvironment {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

/**
 * True only when this build carries the public client token a checkout needs.
 *
 * The BROWSER half. The server half — API key, webhook secret and a product id
 * per plan — is checked server-side, and a surface that opens a checkout on
 * this alone is opening a window onto a payment the server cannot finish.
 */
export function isCheckoutConfigured(): boolean {
  return browserCheckoutConfigured({ VITE_PAYMENTS_CLIENT_TOKEN: clientToken });
}

let paddleInitialized = false;

export async function initializePaddle(): Promise<void> {
  if (!isCheckoutConfigured()) {
    throw new Error("Checkout is not configured on this deployment.");
  }
  if (paddleInitialized) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-paddle]");
    if (existing && window.Paddle) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.dataset["paddle"] = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("The checkout script could not be loaded."));
    document.head.appendChild(script);
  });

  // The provider script spells the live environment "production".
  window.Paddle.Environment.set(getPaddleEnvironment() === "sandbox" ? "sandbox" : "production");
  // Narrowed by `isCheckoutConfigured` above, which is the one place the
  // token's presence is decided.
  window.Paddle.Initialize({ token: clientToken! });
  paddleInitialized = true;
}

/**
 * Turn a stable, human-readable price id into the provider's internal id.
 *
 * The internal ids differ between test and live, so committing one to source
 * would make a test purchase indistinguishable from a real one.
 */
export async function getPaddlePriceId(priceId: string): Promise<string> {
  if (!isCheckoutConfigured()) {
    throw new Error("Checkout is not configured on this deployment.");
  }
  return resolvePaddlePrice({ data: { priceId, environment: getPaddleEnvironment() } });
}
