/**
 * THE CATALOGUE. Every plan OCADE sells, every price it displays, and the rule
 * they all satisfy.
 *
 * CARCC CADANE prices carry a deliberate numeric signature: every displayed
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

/**
 * Plans that were sold under an earlier catalogue and are no longer offered.
 *
 * KEPT, NOT DELETED. A payment record naming `std_8d` is a financial fact, and
 * a database that rejects it cannot store its own history. These ids remain
 * valid for READING historical rows; nothing in the product sells them, prices
 * them, or resolves an entitlement from them.
 */
export type ArchivedPlanId = "demo" | "trial_2d" | "std_8d" | "month_1m" | "year_1y";

export const ARCHIVED_PLAN_IDS: readonly ArchivedPlanId[] = [
  "demo",
  "trial_2d",
  "std_8d",
  "month_1m",
  "year_1y",
] as const;

/**
 * Which catalogue a record was written under.
 *
 * Stamped on checkout intents and payment records so a price change cannot
 * retroactively reinterpret what somebody already bought — and so an event
 * naming an unknown catalogue can be rejected rather than guessed at.
 *
 * Dated, not numbered: "which prices were in force on the 2nd of September" is
 * the question anyone actually asks of a historical record.
 */
export const CATALOGUE_VERSION = "2026-09-02";

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
  name: string;
  /**
   * How long one paid period lasts, in milliseconds. Null for Free, which does
   * not expire — a free account is an account, not a lapsed subscription.
   */
  periodMs: number | null;
  /** One line describing what the plan is for. */
  summary: string;
  /** Whether this plan may be offered for purchase. */
  publiclyAvailable: boolean;
  /** Benefits rendered from the same source as entitlement enforcement. */
  benefits: string[];
  /** Approved devices of each kind. */
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
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

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
    name: "Free",
    periodMs: null,
    summary: "A real account with a fixed allowance, on your own device.",
    publiclyAvailable: true,
    benefits: [
      "28 uses per 6h28m window",
      "Offline Intelligence on this device",
      "Conversations, projects and tasks are kept",
    ],
    desktopDevices: 1,
    mobileDevices: 1,
    prices: [
      { currency: "USD", amountMinor: 0 },
      { currency: "EUR", amountMinor: 0 },
      { currency: "GBP", amountMinor: 0 },
      { currency: "INR", amountMinor: 0 },
    ],
    productIdEnv: null,
  },
  {
    id: "pro_weekly",
    tier: "pro",
    cadence: "weekly",
    name: "Pro weekly",
    periodMs: WEEK,
    summary: "Pro capacity, charged weekly. Cancel any time.",
    publiclyAvailable: true,
    benefits: ["Pro session and weekly capacity", "2 computers + 2 phones", "Standard support"],
    desktopDevices: 2,
    mobileDevices: 2,
    prices: [
      { currency: "USD", amountMinor: 800 },
      { currency: "EUR", amountMinor: 800 },
      { currency: "GBP", amountMinor: 800 },
      { currency: "INR", amountMinor: 28_800 },
    ],
    productIdEnv: "OCADE_PRODUCT_ID_PRO_WEEKLY",
  },
  {
    id: "pro_monthly",
    tier: "pro",
    cadence: "monthly",
    name: "Pro monthly",
    periodMs: MONTH,
    summary: "Pro capacity, charged monthly. Cancel any time.",
    publiclyAvailable: true,
    benefits: ["Pro session and weekly capacity", "2 computers + 2 phones", "Standard support"],
    desktopDevices: 2,
    mobileDevices: 2,
    prices: [
      { currency: "USD", amountMinor: 2_800 },
      { currency: "EUR", amountMinor: 2_800 },
      { currency: "GBP", amountMinor: 2_800 },
      { currency: "INR", amountMinor: 188_800 },
    ],
    productIdEnv: "OCADE_PRODUCT_ID_PRO_MONTHLY",
  },
  {
    id: "max_weekly",
    tier: "max",
    cadence: "weekly",
    name: "Max weekly",
    periodMs: WEEK,
    summary: "Ten times Pro capacity, charged weekly. Cancel any time.",
    publiclyAvailable: true,
    benefits: ["Ten times Pro capacity", "2 computers + 2 phones", "Priority support"],
    desktopDevices: 2,
    mobileDevices: 2,
    prices: [
      { currency: "USD", amountMinor: 2_800 },
      { currency: "EUR", amountMinor: 2_800 },
      { currency: "GBP", amountMinor: 2_800 },
      { currency: "INR", amountMinor: 188_800 },
    ],
    productIdEnv: "OCADE_PRODUCT_ID_MAX_WEEKLY",
  },
  {
    id: "max_monthly",
    tier: "max",
    cadence: "monthly",
    name: "Max monthly",
    periodMs: MONTH,
    summary: "Ten times Pro capacity, charged monthly. Cancel any time.",
    publiclyAvailable: true,
    benefits: ["Ten times Pro capacity", "2 computers + 2 phones", "Priority support"],
    desktopDevices: 2,
    mobileDevices: 2,
    prices: [
      { currency: "USD", amountMinor: 8_800 },
      { currency: "EUR", amountMinor: 8_800 },
      { currency: "GBP", amountMinor: 8_800 },
      { currency: "INR", amountMinor: 588_800 },
    ],
    productIdEnv: "OCADE_PRODUCT_ID_MAX_MONTHLY",
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

/** Whether a string names a plan in the CURRENT catalogue. */
export function isPlanId(value: string): value is PlanId {
  return PLANS.some((plan) => plan.id === value);
}

/**
 * Whether a string names a plan from a retired catalogue.
 *
 * Used when reading history. Never used to price, sell, or resolve an
 * entitlement — an archived plan is a record, not an offer.
 */
export function isArchivedPlanId(value: string): value is ArchivedPlanId {
  return (ARCHIVED_PLAN_IDS as readonly string[]).includes(value);
}

/** The tier a plan belongs to, which is what usage allowances are keyed on. */
export function tierOf(id: PlanId): PlanTier {
  return planById(id)!.tier;
}

/** Plans on sale, in display order. Free first because it is where people start. */
export function sellablePlans(): Plan[] {
  return PLANS.filter((plan) => plan.publiclyAvailable);
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
 * code defect, and the billing screen must be able to say "checkout is not
 * configured yet" instead of failing to render.
 */
export function missingProductIds(env: Record<string, string | undefined>): string[] {
  return PLANS.filter((p) => p.publiclyAvailable && p.productIdEnv !== null)
    .map((p) => p.productIdEnv!)
    .filter((key) => !env[key]?.trim());
}
