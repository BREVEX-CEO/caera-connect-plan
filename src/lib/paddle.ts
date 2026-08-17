/**
 * Browser-side checkout bootstrap.
 *
 * The client token is public by design: it can open a checkout, never read or
 * change an account. Which environment the app is in is derived from the token
 * prefix rather than a separate flag, so the preview cannot claim to be live
 * and a published build cannot silently stay in test.
 *
 * FREE_LAUNCH_MODE is enforced here, below every checkout UI. That makes stale
 * links, admin surfaces and accidental callers fail closed rather than merely
 * hiding their buttons.
 */
import { billingEnabled } from "@/lib/launch-mode";
import { resolvePaddlePrice } from "@/utils/payments.functions";

const clientToken = import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN'] as string | undefined;

declare global {
  interface Window {
    // The provider script defines its own shape at runtime.
    Paddle: any;
  }
}

export type CheckoutEnvironment = "sandbox" | "live";

export function getPaddleEnvironment(): CheckoutEnvironment {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

/**
 * True only when billing is intentionally enabled AND a provider token exists.
 * During free launch a token left in deployment configuration must not make
 * checkout reachable.
 */
export function isCheckoutConfigured(): boolean {
  return billingEnabled() && Boolean(clientToken);
}

let paddleInitialized = false;

export async function initializePaddle(): Promise<void> {
  if (!billingEnabled()) {
    throw new Error("Checkout is disabled while OCADE is in free launch mode.");
  }
  if (paddleInitialized) return;
  if (!clientToken) {
    throw new Error("Checkout is not configured on this deployment.");
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-paddle]");
    if (existing && window.Paddle) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.dataset['paddle'] = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("The checkout script could not be loaded."));
    document.head.appendChild(script);
  });

  // The provider script spells the live environment "production".
  window.Paddle.Environment.set(getPaddleEnvironment() === "sandbox" ? "sandbox" : "production");
  window.Paddle.Initialize({ token: clientToken });
  paddleInitialized = true;
}

/**
 * Turn a stable, human-readable price id into the provider's internal id.
 *
 * The internal ids differ between test and live, so committing one to source
 * would make a test purchase indistinguishable from a real one.
 */
export async function getPaddlePriceId(priceId: string): Promise<string> {
  if (!billingEnabled()) {
    throw new Error("Price resolution is disabled while OCADE is in free launch mode.");
  }
  return resolvePaddlePrice({ data: { priceId, environment: getPaddleEnvironment() } });
}
