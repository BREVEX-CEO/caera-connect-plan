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

import { FREE_LAUNCH_MODE, billingEnabled, paidEntitlementRequired } from "@/lib/launch-mode";
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
  it("keeps the free-launch flag on, and every derived gate closed", () => {
    expect(FREE_LAUNCH_MODE).toBe(true);
    expect(billingEnabled()).toBe(false);
    expect(paidEntitlementRequired()).toBe(false);
  });

  it("refuses any provider that does not admit to being a simulation", () => {
    const twin = new PaymentProviderTwin();
    expect(checkoutAllowed(twin)).toBeNull();

    // The shape a real adapter would have. It is refused on the flag alone, so
    // dropping one in cannot start taking money by accident.
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

  it("puts the plan gate ahead of the button, not only inside the handler", () => {
    /*
     * Two gates were deliberate: one stops a purchase, the other stops the
     * control from being pressable. This asserts the second still exists,
     * because it is the one a reader would think is only cosmetic.
     */
    const source = readFileSync(join(SRC, "components/settings/PlanComparison.tsx"), "utf8");
    expect(source).toContain("const comingSoon = FREE_LAUNCH_MODE;");
    expect(source).toMatch(/checkoutConfigured\s*=\s*!comingSoon/);
    expect(source).toContain("Coming soon");
  });
});
