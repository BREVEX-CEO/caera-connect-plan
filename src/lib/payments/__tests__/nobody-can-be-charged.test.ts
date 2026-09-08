/**
 * The launch promise, asserted against the source rather than against intent.
 *
 * OCADE is free while it launches, and the way that fails is never a decision
 * somebody makes — it is a control that survives a refactor, a provider left
 * reachable, or a payment protocol quietly arriving with a dependency. So this
 * checks the three things that would have to be true for a customer to be
 * charged, and none of them is.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { checkoutAvailability } from "@/lib/payments/checkout-availability";
import { checkoutAllowed } from "@/lib/payments/provider";
import { PaymentProviderTwin } from "@/lib/payments/twin";

const SRC = fileURLToPath(new URL("../../..", import.meta.url));

function sourceFiles(dir = SRC, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      sourceFiles(path, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe("nobody can be charged", () => {
  it("cannot take a payment on this deployment, and says why", () => {
    /*
     * Derived from configuration rather than declared by a flag: a constant
     * saying "nobody may be charged" measures nothing, and would keep saying it
     * on a deployment that had since been given real credentials.
     */
    const availability = checkoutAvailability({}, undefined);
    expect(availability.available).toBe(false);
    expect(availability.missing).toContain("VITE_PAYMENTS_CLIENT_TOKEN");
  });

  it("refuses any provider that does not admit to being a simulation", () => {
    const twin = new PaymentProviderTwin();
    expect(checkoutAllowed(twin)).toBeNull();

    // The shape a real adapter would have. It is refused on
    // `LIVE_PAYMENTS_ENABLED` alone — a hard constant, not deployment
    // configuration — so dropping one in cannot start taking money by accident.
    const real = Object.create(twin) as typeof twin;
    Object.defineProperty(real, "simulated", { value: false });
    const refusal = checkoutAllowed(real);
    expect(refusal?.ok).toBe(false);
    expect(refusal).toMatchObject({ code: "live_payments_disabled" });
  });

  it("ships no x402 payment path at all", () => {
    /*
     * x402 is the pay-per-request protocol the archive carried. It is not
     * disabled behind a flag here — it was never brought across, and this is
     * the check that keeps it that way, because "disabled" is a state that
     * drifts and "absent" is not.
     */
    const offenders = sourceFiles().filter((file) => /x402/i.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("does not even let the billing screen open on an unconfigured deployment", () => {
    /*
     * A third gate, found while removing a dead billing panel: the route
     * itself redirects away before any of its controls render. So the order is
     * — the screen does not open, the button is not pressable, and the handler
     * refuses. Any one of the three would do; all three is why this is safe to
     * ship on a day nobody is watching.
     */
    const route = readFileSync(join(SRC, "routes/_authenticated/settings.billing.tsx"), "utf8");
    expect(route).toMatch(/if \(!isCheckoutConfigured\(\)\) throw redirect\(/);
  });

  it("refuses in the checkout hook itself, whoever calls it", () => {
    const hook = readFileSync(join(SRC, "hooks/usePaddleCheckout.ts"), "utf8");
    expect(hook).toMatch(/if \(!isCheckoutConfigured\(\)\) \{/);
    expect(hook).toContain("CHECKOUT_UNAVAILABLE_NOTICE");
  });

  it("puts the plan gate ahead of the button, not only inside the handler", () => {
    /*
     * Two gates were deliberate: one stops a purchase, the other stops the
     * control from being pressable. This asserts the second still exists,
     * because it is the one a reader would think is only cosmetic.
     */
    const source = readFileSync(join(SRC, "components/settings/PlanComparison.tsx"), "utf8");
    expect(source).toMatch(/checkoutConfigured\s*=\s*\n?\s*missing\.length === 0/);
    expect(source).toContain("checkoutConfigured ? (");
  });

  it("holds the live-charging line separately, and not with a deployment flag", () => {
    /*
     * Checkout availability and LIVE charging are different bars. A configured
     * sandbox deployment may open a checkout; taking real money additionally
     * needs legal identity, bank verification and owner approval, which is why
     * that one is a hard constant a deployment cannot flip.
     */
    const provider = readFileSync(join(SRC, "lib/payments/provider.ts"), "utf8");
    expect(provider).toMatch(/export const LIVE_PAYMENTS_ENABLED = false as const;/);
  });
});
