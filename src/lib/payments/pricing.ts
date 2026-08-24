/**
 * Every price OCADE displays, and the rule they all satisfy.
 *
 * CARCC CADANE prices carry a deliberate numeric signature. The rule, in the
 * order it is applied: every displayed paid price ends in 8 or 28. Prices are
 * stored as integer minor units so $4.28 is exact and never becomes a floating
 * point billing value.
 *
 * WHY THIS IS CODE AND NOT A SPREADSHEET. A price that fails the rule must
 * never reach a screen, and the only reliable way to guarantee that is to make
 * an invalid price impossible to display: `describePrice` throws, and a test
 * asserts every configured amount passes. A convention enforced by memory is a
 * convention that ships broken on a Friday.
 *
 * No `.99`: the pricing rule is a signature, not a psychological trick.
 */

/**
 * Plan identifiers, matching the database.
 *
 * These are the exact values the `ocade_subscriptions.plan_id` CHECK
 * constraint accepts. Inventing friendlier ids here would mean translating at
 * every boundary, and the first translation anyone forgets writes a row the
 * database rejects at runtime.
 */
export type PlanId = "demo" | "trial_2d" | "std_8d" | "month_1m" | "year_1y";
export type CurrencyCode = "USD" | "EUR" | "GBP" | "INR";

export interface PlanPrice {
  currency: CurrencyCode;
  /** Integer minor units: 428 means $4.28 and 28_800 means ₹288. */
  amountMinor: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** How long the entitlement lasts, in milliseconds. Zero for the demo. */
  durationMs: number;
  /** One line describing what the plan is for. */
  summary: string;
  /** Hidden legacy entitlements remain readable but are not sold. */
  publiclyAvailable: boolean;
  /** Benefits rendered from the same source as entitlement enforcement. */
  benefits: string[];
  /** Approved devices of each kind. Same for every paid plan today. */
  desktopDevices: number;
  mobileDevices: number;
  prices: PlanPrice[];
  /**
   * Environment variable holding this plan's product id at the payment
   * provider. The id itself is NEVER in source: it differs per environment and
   * committing it makes a test purchase indistinguishable from a real one.
   */
  productIdEnv: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

export const PLANS: Plan[] = [
  {
    id: "demo",
    name: "Demo",
    durationMs: 28 * 60 * 1000,
    summary: "28 minutes of the real product, in your browser, with no account.",
    publiclyAvailable: false,
    benefits: ["No account", "On-device demo", "No payment details"],
    desktopDevices: 0,
    mobileDevices: 0,
    prices: [
      { currency: "USD", amountMinor: 0 },
      { currency: "EUR", amountMinor: 0 },
      { currency: "GBP", amountMinor: 0 },
      { currency: "INR", amountMinor: 0 },
    ],
    productIdEnv: null,
  },
  {
    id: "trial_2d",
    name: "2 days",
    durationMs: 2 * DAY,
    summary: "Try OCADE properly on your own documents before committing.",
    publiclyAvailable: false,
    benefits: ["Legacy entitlement", "Unlimited local work", "2 computers + 2 phones"],
    desktopDevices: 2,
    mobileDevices: 2,
    prices: [
      { currency: "USD", amountMinor: 228 },
      { currency: "EUR", amountMinor: 228 },
      { currency: "GBP", amountMinor: 228 },
      { currency: "INR", amountMinor: 12_800 },
    ],
    productIdEnv: "OCADE_PRODUCT_ID_TRIAL_2D",
  },
  {
    id: "std_8d",
    name: "8 days",
    durationMs: 8 * DAY,
    summary: "A focused eight-day pass. Everything runs on your own device.",
    publiclyAvailable: true,
    benefits: ["Unlimited on-device work", "2 computers + 2 phones", "Standard support"],
    desktopDevices: 2,
    mobileDevices: 2,
    prices: [
      { currency: "USD", amountMinor: 428 },
      { currency: "EUR", amountMinor: 428 },
      { currency: "GBP", amountMinor: 428 },
      { currency: "INR", amountMinor: 28_800 },
    ],
    productIdEnv: "OCADE_PRODUCT_ID_STD_8D",
  },
  {
    id: "month_1m",
    name: "1 month",
    durationMs: 30 * DAY,
    summary: "A flexible monthly licence for unlimited on-device processing.",
    publiclyAvailable: true,
    benefits: ["Unlimited on-device work", "2 computers + 2 phones", "Priority support"],
    desktopDevices: 2,
    mobileDevices: 2,
    prices: [
      { currency: "USD", amountMinor: 2_800 },
      { currency: "EUR", amountMinor: 2_800 },
      { currency: "GBP", amountMinor: 2_800 },
      { currency: "INR", amountMinor: 48_800 },
    ],
    productIdEnv: "OCADE_PRODUCT_ID_MONTH_1M",
  },
  {
    id: "year_1y",
    name: "1 year",
    durationMs: 365 * DAY,
    summary: "A full year of unlimited on-device processing.",
    publiclyAvailable: true,
    benefits: ["Unlimited on-device work", "2 computers + 2 phones", "Priority support"],
    desktopDevices: 2,
    mobileDevices: 2,
    prices: [
      { currency: "USD", amountMinor: 12_800 },
      { currency: "EUR", amountMinor: 12_800 },
      { currency: "GBP", amountMinor: 12_800 },
      { currency: "INR", amountMinor: 588_800 },
    ],
    productIdEnv: "OCADE_PRODUCT_ID_YEAR_1Y",
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
 * Free is valid by definition — the demo costs nothing and a numeric signature
 * on zero would be meaningless.
 */
export function checkPrice(amountMinor: number, currency: CurrencyCode = "USD"): PriceCheck {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    return { valid: false, reason: "A price must use whole, non-negative minor units." };
  }
  if (amountMinor === 0) return { valid: true, reason: "Free." };

  const amount = amountMinor / 100;
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

/**
 * Which payment product ids are configured, and which are missing.
 *
 * Reported rather than thrown: a missing product id is a deployment fact, not a
 * code defect, and the subscription screen must be able to say "checkout is not
 * configured yet" instead of failing to render.
 */
export function missingProductIds(env: Record<string, string | undefined>): string[] {
  return PLANS.filter((p) => p.publiclyAvailable && p.productIdEnv !== null)
    .map((p) => p.productIdEnv!)
    .filter((key) => !env[key]?.trim());
}
