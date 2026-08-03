import { describe, it, expect } from "vitest";
import {
  MONEY_PACK,
  parseMoney,
  formatMoney,
  invoiceTotal,
  allocate,
  exponentFor,
  type LineItem,
} from "../skills/packs/money-pack";

/**
 * Money arithmetic is only worth having if it is exact. These tests check the
 * cases where a float-based implementation is wrong — and where the wrong
 * answer is off by a penny, which is exactly the size that survives review.
 */

const gbp = (s: string) => {
  const r = parseMoney(s, "GBP");
  if (!r.ok) throw new Error(`fixture failed: ${r.reason}`);
  return r.data;
};

describe("the pack states its own limits", () => {
  it("says plainly that it cannot move money or drive accounting software", () => {
    expect(MONEY_PACK.coverageNote).toMatch(/cannot sign into a bank/i);
    expect(MONEY_PACK.coverageNote).toMatch(/move money/i);
    expect(MONEY_PACK.coverageNote).toMatch(/Xero|QuickBooks|SAP/);
  });
});

describe("amounts are exact, not approximate", () => {
  it("holds an amount as integer minor units", () => {
    expect(gbp("10.05").minorUnits).toBe(1005);
    expect(gbp("0.01").minorUnits).toBe(1);
    expect(gbp("-3.50").minorUnits).toBe(-350);
  });

  /**
   * The canonical float failure: 0.1 + 0.2 === 0.30000000000000004. Held as
   * minor units the same sum is exact.
   */
  it("adds amounts that binary floating point cannot represent", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the bug this pack exists to avoid
    expect(gbp("0.10").minorUnits + gbp("0.20").minorUnits).toBe(gbp("0.30").minorUnits);
  });

  it("reads amounts written with separators and symbols", () => {
    expect(gbp("1,234.56").minorUnits).toBe(123456);
    expect(gbp("£99.99").minorUnits).toBe(9999);
  });

  it("pads a short fraction rather than misreading it", () => {
    // "10.5" is £10.50, not £10.05.
    expect(gbp("10.5").minorUnits).toBe(1050);
  });

  it("refuses more precision than the currency has, instead of rounding", () => {
    const r = parseMoney("10.005", "GBP");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't round it silently/i);
  });

  it("knows currencies without minor units", () => {
    expect(exponentFor("JPY")).toBe(0);
    expect(exponentFor("KWD")).toBe(3);

    const yen = parseMoney("1500", "JPY");
    expect(yen.ok).toBe(true);
    if (!yen.ok) throw new Error("unreachable");
    // ¥1500 is 1500 minor units, not 150000 — the classic factor-of-100 bug.
    expect(yen.data.minorUnits).toBe(1500);

    const fractionalYen = parseMoney("1500.50", "JPY");
    expect(fractionalYen.ok).toBe(false);
  });

  it("handles three-decimal currencies", () => {
    const kwd = parseMoney("12.345", "KWD");
    expect(kwd.ok).toBe(true);
    if (!kwd.ok) throw new Error("unreachable");
    expect(kwd.data.minorUnits).toBe(12345);
  });

  it("refuses text it cannot read rather than guessing", () => {
    for (const bad of ["ten pounds", "", "1.2.3", "12,34", "1e5"]) {
      expect(parseMoney(bad, "GBP").ok).toBe(false);
    }
  });

  it("formats back to what the user typed", () => {
    expect(formatMoney(gbp("1,234.56"))).toBe("1,234.56 GBP");
    expect(formatMoney(gbp("0.07"))).toBe("0.07 GBP");
    expect(formatMoney(gbp("-3.50"))).toBe("-3.50 GBP");
    expect(formatMoney({ minorUnits: 1500, currency: "JPY", exponent: 0 })).toBe("1,500 JPY");
  });
});

describe("invoice totals", () => {
  const items: LineItem[] = [
    { description: "Consulting", unitPrice: 12500, quantity: 3, taxRateBasisPoints: 2000 },
    { description: "Hosting", unitPrice: 999, quantity: 12, taxRateBasisPoints: 2000 },
    { description: "Book", unitPrice: 1499, quantity: 2, taxRateBasisPoints: 0 },
  ];

  it("totals net, tax and gross exactly", () => {
    const r = invoiceTotal(items, "GBP");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    // Independently: 12500×3 = 37500; 999×12 = 11988; 1499×2 = 2998.
    expect(r.data.net).toBe(37500 + 11988 + 2998);
    // 20% band net = 49488 → tax 9897.6 → 9898 half-up. Zero band adds nothing.
    expect(r.data.tax).toBe(9898);
    expect(r.data.gross).toBe(r.data.net + r.data.tax);
  });

  /**
   * Per-line rounding gives a different answer from per-band rounding, and the
   * tax authority expects the band figure. Proving the difference exists is
   * what makes the choice meaningful.
   */
  it("rounds tax per rate band, not per line", () => {
    const perLine = items
      .filter((i) => i.taxRateBasisPoints === 2000)
      .reduce((sum, i) => sum + Math.round((i.unitPrice * i.quantity * 2000) / 10000), 0);

    const r = invoiceTotal(items, "GBP");
    if (!r.ok) throw new Error("unreachable");

    // 37500×0.2 = 7500 exactly; 11988×0.2 = 2397.6 → 2398. Per-line = 9898 too
    // here, so use a case where they genuinely diverge:
    const divergent: LineItem[] = [
      { description: "a", unitPrice: 10, quantity: 1, taxRateBasisPoints: 2500 },
      { description: "b", unitPrice: 10, quantity: 1, taxRateBasisPoints: 2500 },
    ];
    const banded = invoiceTotal(divergent, "GBP");
    if (!banded.ok) throw new Error("unreachable");
    const naive = divergent.reduce(
      (s, i) => s + Math.round((i.unitPrice * i.quantity * 2500) / 10000),
      0,
    );

    // Per line: round(2.5) + round(2.5) = 3 + 3 = 6. Per band: round(5) = 5.
    expect(naive).toBe(6);
    expect(banded.data.tax).toBe(5);
    expect(perLine).toBe(9898); // the first invoice happens to agree
  });

  it("breaks the total down by rate, which is what a return needs", () => {
    const r = invoiceTotal(items, "GBP");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.byRate).toEqual([
      { rateBasisPoints: 0, net: 2998, tax: 0 },
      { rateBasisPoints: 2000, net: 49488, tax: 9898 },
    ]);
  });

  it("refuses a fractional unit price rather than rounding it", () => {
    const r = invoiceTotal(
      [{ description: "x", unitPrice: 10.5, quantity: 1, taxRateBasisPoints: 2000 }],
      "GBP",
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/exact minor units/i);
  });

  it("refuses an empty invoice rather than reporting a total of zero", () => {
    const r = invoiceTotal([], "GBP");
    expect(r.ok).toBe(false);
  });

  it("refuses a negative quantity", () => {
    const r = invoiceTotal(
      [{ description: "x", unitPrice: 100, quantity: -1, taxRateBasisPoints: 0 }],
      "GBP",
    );
    expect(r.ok).toBe(false);
  });
});

describe("splitting money never loses or invents a penny", () => {
  it("splits evenly when it divides exactly", () => {
    const r = allocate(900, [1, 1, 1]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toEqual([300, 300, 300]);
  });

  /**
   * The case that catches naive implementations: £0.10 three ways. Rounding
   * each share gives 3+3+3 = 9, losing a penny.
   */
  it("distributes the remainder rather than dropping it", () => {
    const r = allocate(10, [1, 1, 1]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.reduce((a, b) => a + b, 0)).toBe(10);
    expect(r.data).toEqual([4, 3, 3]);
  });

  it("sums back exactly for every awkward split", () => {
    for (const total of [1, 7, 10, 99, 100, 101, 1234567]) {
      for (const parts of [2, 3, 6, 7, 11]) {
        const r = allocate(total, Array(parts).fill(1));
        if (!r.ok) throw new Error(`unreachable for ${total}/${parts}`);
        expect(r.data.reduce((a, b) => a + b, 0)).toBe(total);
        // No share may differ from another by more than one minor unit.
        expect(Math.max(...r.data) - Math.min(...r.data)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("respects uneven weights and still sums exactly", () => {
    const r = allocate(1000, [70, 20, 10]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toEqual([700, 200, 100]);

    const awkward = allocate(1000, [1, 1, 1, 1, 1, 1, 1]);
    if (!awkward.ok) throw new Error("unreachable");
    expect(awkward.data.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("refuses a split it cannot make meaningfully", () => {
    expect(allocate(100, []).ok).toBe(false);
    expect(allocate(100, [0, 0]).ok).toBe(false);
    expect(allocate(100, [-1, 2]).ok).toBe(false);
    expect(allocate(10.5, [1, 1]).ok).toBe(false);
  });

  it("handles a zero-weight participant without giving them money", () => {
    const r = allocate(100, [1, 0, 1]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data[1]).toBe(0);
    expect(r.data.reduce((a, b) => a + b, 0)).toBe(100);
  });
});
