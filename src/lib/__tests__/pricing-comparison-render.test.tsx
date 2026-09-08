import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanComparison } from "@/components/settings/PlanComparison";
import { PLANS } from "@/lib/payments/pricing";
import { CHECKOUT_UNAVAILABLE_NOTICE } from "@/lib/payments/checkout-availability";

describe("public plan comparison", () => {
  it("renders every public plan and its feature list from the pricing authority", () => {
    const html = renderToStaticMarkup(<PlanComparison deploymentDetails={false} />);

    for (const plan of PLANS.filter((candidate) => candidate.publiclyAvailable)) {
      expect(html, plan.id).toContain(plan.name);
      for (const benefit of plan.benefits) expect(html, plan.id).toContain(benefit);
    }
  });

  it("names Free without offering to sell it", () => {
    /*
     * Free is what an account already has. It belongs on the page — leaving it
     * off would make the paid tiers look like the only way to use OCADE — but a
     * "Choose Free" control would be a checkout for nothing.
     */
    const html = renderToStaticMarkup(<PlanComparison deploymentDetails={false} />);
    const free = PLANS.find((plan) => plan.tier === "free")!;
    expect(html).toContain(free.name);
    expect(html).toContain(free.summary);
    expect(html).not.toContain(`Choose ${free.name}`);
  });

  it("compares plans without exposing any route to a payment", () => {
    /*
     * The property that matters, and it is unchanged through two rewrites of
     * how this state is reached: every plan is fully described and fully
     * priced, and there is no way from this card to a charge.
     */
    const html = renderToStaticMarkup(<PlanComparison deploymentDetails={false} />);
    expect(html).toContain(CHECKOUT_UNAVAILABLE_NOTICE);
    for (const plan of PLANS.filter((candidate) => candidate.tier !== "free")) {
      expect(html, plan.id).not.toContain(`Choose ${plan.name}`);
    }
    expect(html).not.toContain("Start checkout");
  });

  it("still shows what each paid plan costs", () => {
    // Hiding the prices would answer "what will this cost?" with silence,
    // which is the question this component exists for.
    const html = renderToStaticMarkup(<PlanComparison deploymentDetails={false} />);
    expect(html).toMatch(/\$8\b/);
    expect(html).toMatch(/\$28\b/);
    expect(html).toMatch(/\$88\b/);
  });
});
