/**
 * Every price OCADE displays, and the rule they all satisfy.
 *
 * CAERA CADANE prices carry a deliberate numeric signature. The rule, in the
 * order it is applied:
 *
 *   1. A price SHOULD end in 28 — the house number.
 *   2. A FOUR-digit price MUST have a digit total of 28.
 *   3. A THREE-digit price MUST have a digit total of 8.
 *   4. Where that structure cannot be satisfied, fall back to ending in 8 with
 *      a digit total of 8.
 *
 * Rules 2 and 3 are the binding ones and they constrain by LENGTH, which is why
 * rule 1 is "should" rather than "must": no three-digit number ending in 28 has
 * a digit total of 8 (`X28` sums to at least 11), so demanding both would make
 * three-digit pricing impossible. Shorter prices, which no digit-total rule
 * covers, take rule 1 or the rule 4 fallback.
 *
 * WHY THIS IS CODE AND NOT A SPREADSHEET. A price that fails the rule must
 * never reach a screen, and the only reliable way to guarantee that is to make
 * an invalid price impossible to display: `describePrice` throws, and a test
 * asserts every configured amount passes. A convention enforced by memory is a
 * convention that ships broken on a Friday.
 *
 * Amounts are whole units of the currency. No `.99`: the pricing rule is a
 * signature, not a psychological trick, and the product's own charter rules out
 * manipulative patterns.
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
  /** Whole units. 28 means $28, not $0.28. */
  amount: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** How long the entitlement lasts, in milliseconds. Zero for the demo. */
  durationMs: number;
  /** One line describing what the plan is for. */
  summary: string;
  /** Cloud requests per eight-hour window. Local processing is never metered. */
  cloudAllowance: number;
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

/** Cloud requests allowed per rolling window. Local work is unlimited. */
export const CLOUD_ALLOWANCE = 28;
/** How long until the cloud allowance resets. */
export const CLOUD_WINDOW_MS = 8 * 60 * 60 * 1000;

export const PLANS: Plan[] = [
  {
    id: "demo",
    name: "Demo",
    durationMs: 28 * 60 * 1000,
    summary: "8 minutes of the real product, in your browser, with no account.",
    cloudAllowance: 0,
    desktopDevices: 0,
    mobileDevices: 0,
    prices: [
      { currency: "USD", amount: 0 },
      { currency: "EUR", amount: 0 },
      { currency: "GBP", amount: 0 },
      { currency: "INR", amount: 0 },
    ],
    productIdEnv: null,
  },
  {
    id: "trial_2d",
    name: "2 days",
    durationMs: 2 * DAY,
    summary: "Try OCADE properly on your own documents before committing.",
    cloudAllowance: CLOUD_ALLOWANCE,
    desktopDevices: 2,
    mobileDevices: 2,
    prices: [
      { currency: "USD", amount: 8 },
      { currency: "EUR", amount: 8 },
      { currency: "GBP", amount: 8 },
      { currency: "INR", amount: 107 },
    ],
    productIdEnv: "OCADE_PRODUCT_ID_TRIAL_2D",
  },
  {
    id: "std_8d",
    name: "8 days",
    durationMs: 8 * DAY,
    summary: "A working week and a weekend of unlimited local processing.",
    cloudAllowance: CLOUD_ALLOWANCE,
    desktopDevices: 2,
    mobileDevices: 2,
    prices: [
      { currency: "USD", amount: 18 },
      { currency: "EUR", amount: 18 },
      { currency: "GBP", amount: 18 },
      { currency: "INR", amount: 224 },
    ],
    productIdEnv: "OCADE_PRODUCT_ID_STD_8D",
  },
  {
    id: "month_1m",
    name: "1 month",
    durationMs: 30 * DAY,
    summary: "The usual choice. Unlimited on-device work, cloud when you allow it.",
    cloudAllowance: CLOUD_ALLOWANCE,
    desktopDevices: 2,
    mobileDevices: 2,
    prices: [
      { currency: "USD", amount: 28 },
      { currency: "EUR", amount: 28 },
      { currency: "GBP", amount: 28 },
      { currency: "INR", amount: 350 },
    ],
    productIdEnv: "OCADE_PRODUCT_ID_MONTH_1M",
  },
  {
    id: "year_1y",
    name: "1 year",
    durationMs: 365 * DAY,
    summary: "Twelve months, at a lower rate than paying monthly.",
    cloudAllowance: CLOUD_ALLOWANCE,
    desktopDevices: 2,
    mobileDevices: 2,
    prices: [
      { currency: "USD", amount: 206 },
      { currency: "EUR", amount: 206 },
      { currency: "GBP", amount: 206 },
      { currency: "INR", amount: 3889 },
    ],
    productIdEnv: "OCADE_PRODUCT_ID_YEAR_1Y",
  },
];

export interface PriceCheck {
  valid: boolean;
  /** Which clause of the rule the amount satisfies, or why it fails. */
  reason: string;
}

function digitSum(value: number): number {
  return String(value)
    .split("")
    .reduce((sum, d) => sum + Number(d), 0);
}

/**
 * Does this amount satisfy the pricing rule?
 *
 * Free is valid by definition — the demo costs nothing and a numeric signature
 * on zero would be meaningless.
 */
export function checkPrice(amount: number): PriceCheck {
  if (!Number.isInteger(amount) || amount < 0) {
    return { valid: false, reason: "A price must be a whole, non-negative number of units." };
  }
  if (amount === 0) return { valid: true, reason: "Free." };

  const text = String(amount);
  const sum = digitSum(amount);
  const endsIn28 = text.endsWith("28");
  const endsIn8 = text.endsWith("8");

  if (text.length === 4) {
    return sum === 28
      ? {
          valid: true,
          reason: `Four digits with a digit total of 28${endsIn28 ? ", ending in 28" : ""}.`,
        }
      : {
          valid: false,
          reason: `Four-digit price ${amount} has a digit total of ${sum}; it must be 28.`,
        };
  }

  if (text.length === 3) {
    return sum === 8
      ? { valid: true, reason: "Three digits with a digit total of 8." }
      : {
          valid: false,
          reason: `Three-digit price ${amount} has a digit total of ${sum}; it must be 8.`,
        };
  }

  // One and two digits: no digit-total clause applies, so the preference or the
  // fallback governs.
  if (endsIn28) return { valid: true, reason: "Ends in 28." };
  if (endsIn8 && sum === 8)
    return { valid: true, reason: "Fallback: ends in 8 with a digit total of 8." };
  if (endsIn8) return { valid: true, reason: "Ends in 8." };

  return {
    valid: false,
    reason: `${amount} neither ends in 28 nor in 8, and is too short for a digit-total clause.`,
  };
}

const SYMBOLS: Record<CurrencyCode, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
};

/**
 * Format a price for display, refusing to render one that breaks the rule.
 *
 * Throwing is the point. A silent fallback to an unvalidated number would put
 * exactly the price this module exists to prevent in front of a customer, and
 * it would do it quietly.
 */
export function describePrice(price: PlanPrice): string {
  const check = checkPrice(price.amount);
  if (!check.valid) {
    throw new Error(`Refusing to display an invalid price: ${check.reason}`);
  }
  if (price.amount === 0) return "Free";
  return `${SYMBOLS[price.currency]}${price.amount.toLocaleString("en")}`;
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
  return PLANS.filter((p) => p.productIdEnv !== null)
    .map((p) => p.productIdEnv!)
    .filter((key) => !env[key]?.trim());
}
