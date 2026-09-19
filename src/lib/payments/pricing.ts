/**
 * THE CATALOGUE. Every plan OCADE sells, every price it displays, and the rule
 * they all satisfy.
 *
 * CARCC prices carry a deliberate numeric signature: every displayed
 * paid price ends in 8 or 28. Prices are stored as integer minor units so £8.00
 * is exact and never becomes a floating-point billing value.
 *
 * WHY THIS IS CODE AND NOT A SPREADSHEET. A price that fails the rule must
 * never reach a screen, and the only reliable way to guarantee that is to make
 * an invalid price impossible to display: `describePrice` throws, and a test
 * asserts every configured amount passes. A convention enforced by memory is a
 * convention that ships broken on a Friday.
 *
 * No `.99`: the signature is a signature, not a psychological trick.
 *
 * THE SERVER OWNS THIS FILE'S MEANING. What a customer is charged is decided
 * here and on the server, never by the browser. A checkout is opened against a
 * plan id resolved from this catalogue and an amount the server looked up; a
 * client that asks for a different price is refused rather than obliged.
 */

/**
 * What a plan gives you. Cadence is how often it is charged.
 *
 * Separated because they vary independently and are asked about separately:
 * usage allowances are a property of the TIER, and renewal terms are a property
 * of the CADENCE. Collapsing them into one id and destructuring it at each
 * call site is how a monthly plan ends up with a weekly allowance.
 */
export type PlanTier = "free" | "pro" | "max";
export type PlanCadence = "weekly" | "monthly";

/**
 * Plan identifiers, matching the database.
 *
 * These are the exact values the `plan_id` CHECK constraints accept. Inventing
 * friendlier ids here would mean translating at every boundary, and the first
 * translation anyone forgets writes a row the database rejects at runtime.
 */
export type PlanId = "free" | "pro_weekly" | "pro_monthly" | "max_weekly" | "max_monthly";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "INR";

export interface PlanPrice {
  currency: CurrencyCode;
  /** Integer minor units: 800 means $8.00 and 28_800 means ₹288. */
  amountMinor: number;
}

export interface Plan {
  id: PlanId;
  tier: PlanTier;
  /** Null for Free, which is not charged and therefore has no cadence. */
  cadence: PlanCadence | null;
  /** One line describing what the plan is for. */
  summary: string;
  prices: PlanPrice[];
}

/**
 * The approved price anchors.
 *
 * Written as one table because that is how they were approved and how they are
 * checked. USD, EUR and GBP carry the same figure deliberately: these are
 * anchors, not conversions, and quoting a converted number that drifts daily
 * would make the displayed price unpredictable.
 */
export const PLANS: Plan[] = [
  {
    id: "free",
    tier: "free",
    cadence: null,
    summary: "A real account with a fixed allowance, on your own device.",
    prices: [
      { currency: "USD", amountMinor: 0 },
      { currency: "EUR", amountMinor: 0 },
      { currency: "GBP", amountMinor: 0 },
      { currency: "INR", amountMinor: 0 },
    ],
  },
  {
    id: "pro_weekly",
    tier: "pro",
    cadence: "weekly",
    summary: "Pro capacity, charged weekly. Cancel any time.",
    prices: [
      { currency: "USD", amountMinor: 800 },
      { currency: "EUR", amountMinor: 800 },
      { currency: "GBP", amountMinor: 800 },
      { currency: "INR", amountMinor: 28_800 },
    ],
  },
  {
    id: "pro_monthly",
    tier: "pro",
    cadence: "monthly",
    summary: "Pro capacity, charged monthly. Cancel any time.",
    prices: [
      { currency: "USD", amountMinor: 2_800 },
      { currency: "EUR", amountMinor: 2_800 },
      { currency: "GBP", amountMinor: 2_800 },
      { currency: "INR", amountMinor: 188_800 },
    ],
  },
  {
    id: "max_weekly",
    tier: "max",
    cadence: "weekly",
    summary: "Ten times Pro capacity, charged weekly. Cancel any time.",
    prices: [
      { currency: "USD", amountMinor: 2_800 },
      { currency: "EUR", amountMinor: 2_800 },
      { currency: "GBP", amountMinor: 2_800 },
      { currency: "INR", amountMinor: 188_800 },
    ],
  },
  {
    id: "max_monthly",
    tier: "max",
    cadence: "monthly",
    summary: "Ten times Pro capacity, charged monthly. Cancel any time.",
    prices: [
      { currency: "USD", amountMinor: 8_800 },
      { currency: "EUR", amountMinor: 8_800 },
      { currency: "GBP", amountMinor: 8_800 },
      { currency: "INR", amountMinor: 588_800 },
    ],
  },
];

export interface PriceCheck {
  valid: boolean;
  /** Which clause of the rule the amount satisfies, or why it fails. */
  reason: string;
}

/**
 * Does this amount satisfy the pricing rule?
 *
 * Free is valid by definition — a numeric signature on zero would be
 * meaningless.
 */
function checkPrice(amountMinor: number, currency: CurrencyCode = "USD"): PriceCheck {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    return { valid: false, reason: "A price must use whole, non-negative minor units." };
  }
  if (amountMinor === 0) return { valid: true, reason: "Free." };

  const amount = amountMinor / 100;
  // locale-independent: this renders the amount only to inspect its trailing
  // digits against the pricing rule. Grouping is off and the string is never
  // shown; a reader's locale would change the separators and the test with it.
  const text = new Intl.NumberFormat("en-US", {
    useGrouping: false,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  if (text.endsWith("28")) return { valid: true, reason: "Displayed price ends in 28." };
  if (text.endsWith("8")) return { valid: true, reason: "Displayed price ends in 8." };

  return {
    valid: false,
    reason: `Displayed ${currency} price ${text} must end in 8 or 28.`,
  };
}

/**
 * Format a price for display, refusing to render one that breaks the rule.
 *
 * Throwing is the point. A silent fallback to an unvalidated number would put
 * exactly the price this module exists to prevent in front of a customer, and
 * it would do it quietly.
 */
export function describePrice(price: PlanPrice): string {
  const check = checkPrice(price.amountMinor, price.currency);
  if (!check.valid) {
    throw new Error(`Refusing to display an invalid price: ${check.reason}`);
  }
  if (price.amountMinor === 0) return "Free";
  const amount = price.amountMinor / 100;
  return new Intl.NumberFormat(price.currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: price.currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** The plan, by id. */
export function planById(id: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/**
 * Pick the currency for a region.
 *
 * Falls back to USD rather than guessing: showing a European price to someone
 * whose region we could not read is worse than showing a familiar dollar figure
 * they can convert.
 */
export function currencyForRegion(regionCode: string | null | undefined): CurrencyCode {
  const region = (regionCode ?? "").toUpperCase();
  if (region === "IN") return "INR";
  if (region === "GB" || region === "UK") return "GBP";
  const EURO = new Set([
    "AT",
    "BE",
    "CY",
    "DE",
    "EE",
    "ES",
    "FI",
    "FR",
    "GR",
    "HR",
    "IE",
    "IT",
    "LT",
    "LU",
    "LV",
    "MT",
    "NL",
    "PT",
    "SI",
    "SK",
  ]);
  if (EURO.has(region)) return "EUR";
  return "USD";
}

/** Read the region from the browser, or null when it cannot be determined. */
export function detectRegion(): string | null {
  if (typeof Intl === "undefined") return null;
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
    const match = /-([A-Z]{2})\b/.exec(locale.toUpperCase());
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function priceFor(plan: Plan, currency: CurrencyCode): PlanPrice {
  const found = plan.prices.find((p) => p.currency === currency);
  // Every plan carries every supported currency; the test enforces it. The
  // fallback exists so a future currency cannot crash a checkout screen.
  return found ?? plan.prices.find((p) => p.currency === "USD")!;
}
