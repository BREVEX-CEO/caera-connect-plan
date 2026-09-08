/**
 * The plans OCADE actually sells, and the provider ids they map to.
 *
 * These are the human-readable ids created in the provider catalogue. They are
 * stable across the test and live environments, which is exactly why they, and
 * not the provider's internal ids, are the thing source code is allowed to
 * know. Anything not listed here cannot be bought — the checkout refuses an
 * unknown plan rather than opening a window for an amount nobody approved.
 *
 * FREE IS NOT HERE. It is a real account plan, granted by having an account,
 * and there is nothing to charge for it. A "sellable" free plan would mean a
 * checkout for zero, which is a payment flow with no payment in it.
 */
import {
  PLANS,
  priceFor,
  describePrice,
  type CurrencyCode,
  type PlanCadence,
  type PlanId,
} from "./pricing";

export interface SellablePlan {
  planId: Exclude<PlanId, "free">;
  /** Human-readable product id in the provider catalogue. */
  productId: string;
  /** Human-readable price id passed to checkout. */
  priceId: string;
  /** How the charge repeats. */
  cadence: PlanCadence;
  cadenceNote: string;
}

const WEEKLY_NOTE = "Renews every week until you cancel. Cancel any time.";
const MONTHLY_NOTE = "Renews every month until you cancel. Cancel any time.";

export const SELLABLE_PLANS: SellablePlan[] = [
  {
    planId: "pro_weekly",
    productId: "ocade_pro",
    priceId: "ocade_pro_weekly",
    cadence: "weekly",
    cadenceNote: WEEKLY_NOTE,
  },
  {
    planId: "pro_monthly",
    productId: "ocade_pro",
    priceId: "ocade_pro_monthly",
    cadence: "monthly",
    cadenceNote: MONTHLY_NOTE,
  },
  {
    planId: "max_weekly",
    productId: "ocade_max",
    priceId: "ocade_max_weekly",
    cadence: "weekly",
    cadenceNote: WEEKLY_NOTE,
  },
  {
    planId: "max_monthly",
    productId: "ocade_max",
    priceId: "ocade_max_monthly",
    cadence: "monthly",
    cadenceNote: MONTHLY_NOTE,
  },
];

export function sellablePlanByPlanId(planId: string): SellablePlan | undefined {
  return SELLABLE_PLANS.find((p) => p.planId === planId);
}

/**
 * The plan a price id names.
 *
 * Price id and not product id, because the two cadences of one tier share a
 * product. Resolving by product would make a weekly purchase indistinguishable
 * from a monthly one — and the amount charged is the difference.
 */
export function sellablePlanByPriceId(priceId: string): SellablePlan | undefined {
  return SELLABLE_PLANS.find((p) => p.priceId === priceId);
}

/**
 * Every plan sold under one provider product.
 *
 * Returns a list, because a product now carries both cadences. A caller that
 * needs one plan must say which cadence it means.
 */
export function sellablePlansByProductId(productId: string): SellablePlan[] {
  return SELLABLE_PLANS.filter((p) => p.productId === productId);
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
