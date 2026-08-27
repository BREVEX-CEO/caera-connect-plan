import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanComparison } from "@/components/settings/PlanComparison";
import { PLANS } from "@/lib/payments/pricing";

describe("public plan comparison", () => {
  it("renders every public plan and its feature list from the pricing authority", () => {
    const html = renderToStaticMarkup(<PlanComparison deploymentDetails={false} />);

    for (const plan of PLANS.filter((candidate) => candidate.publiclyAvailable)) {
      expect(html).toContain(plan.name);
      expect(html).toContain(plan.summary);
      for (const benefit of plan.benefits) expect(html).toContain(benefit);
    }
    expect(html).toContain("Unlimited on-device processing");
    expect(html).toContain("nothing is charged today");
  });

  it("compares plans without exposing a purchase control during free launch", () => {
    const html = renderToStaticMarkup(<PlanComparison deploymentDetails={false} />);
    /*
     * The grey paragraph this used to assert has become a real, permanently
     * disabled control reading "Coming soon". The property under test is
     * unchanged and is what matters: the plan is fully described, fully priced,
     * and there is no way from this card to a payment.
     */
    expect(html).toContain("Coming soon");
    expect(html).toContain("disabled");
    expect(html).toContain("aria-disabled");
    expect(html).not.toContain("Choose Standard");
    expect(html).not.toContain("Start checkout");
  });
});
