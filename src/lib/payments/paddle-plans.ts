/**
 * The three plans OCADE actually sells, and the provider ids they map to.
 *
 * These are the human-readable ids created in the provider catalogue. They are
 * stable across the test and live environments, which is exactly why they, and
 * not the provider's internal ids, are the thing source code is allowed to
 * know. Anything not listed here cannot be bought — the checkout refuses an
 * unknown plan rather than opening a window for an amount nobody approved.
 */
import { PLANS, priceFor, describePrice, type CurrencyCode, type PlanId } from "./pricing";

export interface SellablePlan {
  planId: Extract<PlanId, "std_8d" | "month_1m" | "year_1y">;
  /** Human-readable product id in the provider catalogue. */
  productId: string;
  /** Human-readable price id passed to checkout. */
  priceId: string;
  /** How the charge repeats, in plain words. */
  cadence: "one-time" | "monthly" | "yearly";
  cadenceNote: string;
}

export const SELLABLE_PLANS: SellablePlan[] = [
  {
    planId: "std_8d",
    productId: "ocade_std_8d",
    priceId: "ocade_std_8d_once",
    cadence: "one-time",
    cadenceNote: "Charged once. Access ends after 8 days unless you buy again.",
  },
  {
    planId: "month_1m",
    productId: "ocade_month_1m",
    priceId: "ocade_month_1m_monthly",
    cadence: "monthly",
    cadenceNote: "Renews every month until you cancel. Cancel any time.",
  },
  {
    planId: "year_1y",
    productId: "ocade_year_1y",
    priceId: "ocade_year_1y_yearly",
    cadence: "yearly",
    cadenceNote: "Renews every year until you cancel. Cancel any time.",
  },
];

export function sellablePlanByPlanId(planId: string): SellablePlan | undefined {
  return SELLABLE_PLANS.find((p) => p.planId === planId);
}

export function sellablePlanByPriceId(priceId: string): SellablePlan | undefined {
  return SELLABLE_PLANS.find((p) => p.priceId === priceId);
}

export function sellablePlanByProductId(productId: string): SellablePlan | undefined {
  return SELLABLE_PLANS.find((p) => p.productId === productId);
}

/** Name, summary, benefits and formatted price for a sellable plan. */
export function describeSellablePlan(plan: SellablePlan, currency: CurrencyCode) {
  const configured = PLANS.find((p) => p.id === plan.planId)!;
  return {
    ...plan,
    name: configured.name,
    summary: configured.summary,
    benefits: configured.benefits,
    price: describePrice(priceFor(configured, currency)),
  };
}
