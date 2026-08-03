/**
 * Money skill pack — a REAL, executed adapter for the accounting/tax/commerce
 * category.
 *
 * Scope, stated plainly: this pack does arithmetic on amounts you give it. It
 * does not sign into a bank, move funds, file a return, or drive SAP, Xero or
 * QuickBooks. `coverageNote` says so on the pack itself.
 *
 * Every amount is held as an **integer number of minor units** (pence, cents).
 * Binary floating point cannot represent 0.10, so `0.1 + 0.2 !== 0.3`; an
 * invoice built from doubles is wrong by a penny often enough to fail
 * reconciliation, and always looks right on screen. Nothing here ever holds a
 * money value in a float.
 *
 * The second rule: **a split must sum to the total.** Rounding each share
 * independently loses or invents money. Allocation below uses largest-remainder
 * so the parts always add back up exactly.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

const CAPABILITIES: SkillCapability[] = [
  {
    id: "money.parse",
    label: "Read an amount exactly",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
  {
    id: "money.invoice_total",
    label: "Total an invoice, with tax",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
  {
    id: "money.allocate",
    label: "Split an amount without losing a penny",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
];

export const MONEY_PACK: SkillPack = {
  appId: "ocade.money",
  displayName: "Invoices and money arithmetic",
  category: "finance_commerce",
  testedVersions: ["1."],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
  coverageNote:
    "Calculates on amounts you provide. OCADE cannot sign into a bank, move money, file a tax return, or operate accounting software such as SAP, Xero or QuickBooks.",
};

export type MoneyOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

/** An exact amount: integer minor units plus the currency they belong to. */
export interface Money {
  /** Pence, cents, etc. Never a fraction. */
  minorUnits: number;
  currency: string;
  /** Minor units per major unit — 2 for GBP/EUR/USD, 0 for JPY, 3 for KWD. */
  exponent: number;
}

/**
 * Currencies with an exponent other than 2. Getting JPY wrong by a factor of
 * 100 is the classic version of this bug.
 */
const EXPONENTS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  JOD: 3,
};

export function exponentFor(currency: string): number {
  return EXPONENTS[currency.toUpperCase()] ?? 2;
}

/**
 * Read an amount written the way people write them.
 *
 * Refuses more decimal places than the currency actually has, rather than
 * rounding: "10.005" in GBP is either a typo or a value from a system with
 * different precision, and quietly turning it into £10.01 hides which.
 */
export function parseMoney(input: string, currency: string): MoneyOutcome<Money> {
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return { ok: false, reason: `“${currency}” isn't a three-letter currency code.` };
  }

  const exponent = exponentFor(code);
  // Thousands separators are stripped; the decimal point is not guessed.
  const cleaned = input
    .trim()
    .replace(/[\s,](?=\d{3}\b)/g, "")
    .replace(/[£$€]/g, "");

  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(cleaned);
  if (!m) {
    return {
      ok: false,
      reason: `OCADE can't read “${input}” as an amount. It won't guess — a misread figure is worse than no figure.`,
    };
  }

  const [, sign, whole, frac = ""] = m;
  if (frac.length > exponent) {
    return {
      ok: false,
      reason:
        exponent === 0
          ? `${code} has no minor unit, so “${input}” can't be exact. OCADE won't round it for you.`
          : `${code} has ${exponent} decimal places, but “${input}” has ${frac.length}. OCADE won't round it silently.`,
    };
  }

  const padded = frac.padEnd(exponent, "0");
  const minorUnits = Number(`${sign}${whole}${padded}`);
  if (!Number.isSafeInteger(minorUnits)) {
    return { ok: false, reason: `${input} is too large to hold exactly.` };
  }

  return {
    ok: true,
    data: { minorUnits, currency: code, exponent },
    evidence: `${formatMoney({ minorUnits, currency: code, exponent })} held as ${minorUnits} minor unit${Math.abs(minorUnits) === 1 ? "" : "s"}.`,
  };
}

export function formatMoney(m: Money): string {
  const negative = m.minorUnits < 0;
  const abs = Math.abs(m.minorUnits)
    .toString()
    .padStart(m.exponent + 1, "0");
  const whole = m.exponent === 0 ? abs : abs.slice(0, -m.exponent);
  const frac = m.exponent === 0 ? "" : `.${abs.slice(-m.exponent)}`;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${frac} ${m.currency}`;
}

/* -------------------------------------------------------------- invoices -- */

export interface LineItem {
  description: string;
  /** Unit price in minor units. */
  unitPrice: number;
  quantity: number;
  /** Tax rate in basis points — 2000 = 20%. Integers, so no float rate drift. */
  taxRateBasisPoints: number;
}

export interface InvoiceTotal {
  net: number;
  tax: number;
  gross: number;
  currency: string;
  exponent: number;
  /** Per-rate breakdown, which is what a tax return actually needs. */
  byRate: { rateBasisPoints: number; net: number; tax: number }[];
}

/**
 * Total an invoice.
 *
 * Tax is computed **per rate band on the summed net**, not per line. Rounding
 * each line's tax separately and adding them up gives a different figure from
 * the one the tax authority expects, and the difference grows with line count.
 */
export function invoiceTotal(items: LineItem[], currency: string): MoneyOutcome<InvoiceTotal> {
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return { ok: false, reason: `“${currency}” isn't a three-letter currency code.` };
  }
  if (items.length === 0) {
    return { ok: false, reason: "There are no line items, so there is no total." };
  }

  for (const [i, item] of items.entries()) {
    if (!Number.isSafeInteger(item.unitPrice)) {
      return {
        ok: false,
        reason: `Line ${i + 1} (“${item.description}”) has a fractional unit price. Prices must be exact minor units — read them with parseMoney first.`,
      };
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
      return {
        ok: false,
        reason: `Line ${i + 1} (“${item.description}”) has an invalid quantity.`,
      };
    }
    if (!Number.isInteger(item.taxRateBasisPoints) || item.taxRateBasisPoints < 0) {
      return {
        ok: false,
        reason: `Line ${i + 1} (“${item.description}”) has an invalid tax rate.`,
      };
    }
  }

  const bands = new Map<number, number>();
  for (const item of items) {
    const lineNet = item.unitPrice * item.quantity;
    bands.set(item.taxRateBasisPoints, (bands.get(item.taxRateBasisPoints) ?? 0) + lineNet);
  }

  const byRate = [...bands.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rateBasisPoints, net]) => ({
      rateBasisPoints,
      net,
      // Half-up on the band total, which is the near-universal convention.
      tax: Math.round((net * rateBasisPoints) / 10000),
    }));

  const net = byRate.reduce((a, b) => a + b.net, 0);
  const tax = byRate.reduce((a, b) => a + b.tax, 0);
  const exponent = exponentFor(code);

  return {
    ok: true,
    data: { net, tax, gross: net + tax, currency: code, exponent, byRate },
    evidence: `${items.length} line${items.length === 1 ? "" : "s"}: net ${formatMoney({ minorUnits: net, currency: code, exponent })}, tax ${formatMoney({ minorUnits: tax, currency: code, exponent })}, total ${formatMoney({ minorUnits: net + tax, currency: code, exponent })}.`,
  };
}

/* ------------------------------------------------------------ allocation -- */

/**
 * Split an amount into shares that sum EXACTLY back to it.
 *
 * Largest-remainder: give everyone their floor, then hand the leftover minor
 * units to the shares with the largest fractional parts. Rounding each share
 * independently is the version of this that loses a penny — and a penny that
 * vanishes from a payout run is a reconciliation failure, not a rounding
 * detail.
 */
export function allocate(total: number, weights: number[]): MoneyOutcome<number[]> {
  if (!Number.isSafeInteger(total)) {
    return { ok: false, reason: "The amount to split must be exact minor units." };
  }
  if (weights.length === 0) return { ok: false, reason: "There's nobody to split this between." };
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    return { ok: false, reason: "Every share must be zero or more." };
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    return { ok: false, reason: "The shares add up to zero, so there's no way to divide this." };
  }

  const exact = weights.map((w) => (total * w) / totalWeight);
  const shares = exact.map((e) => Math.floor(e));
  let remainder = total - shares.reduce((a, b) => a + b, 0);

  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  for (let k = 0; remainder > 0; k++, remainder--) {
    shares[order[k % order.length].i] += 1;
  }

  const sum = shares.reduce((a, b) => a + b, 0);
  if (sum !== total) {
    // Defensive: reaching here would mean the invariant this function exists
    // for was broken, so it reports failure rather than returning bad money.
    return {
      ok: false,
      reason: `Split failed an internal check: parts total ${sum}, not ${total}.`,
    };
  }

  return {
    ok: true,
    data: shares,
    evidence: `Split ${total} into ${shares.length} share${shares.length === 1 ? "" : "s"} totalling exactly ${sum}.`,
  };
}
