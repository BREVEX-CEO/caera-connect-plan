import { describe, it, expect } from "vitest";
import {
  calcIncomeTaxNewRegime,
  calcTdsSection,
  calcPf,
  calcEsi,
  runCalculator,
  compareExpected,
} from "../india-calculators";

/**
 * India country-pack deterministic calculators.
 *
 * These produce numbers a user may rely on for tax and payroll, so the
 * arithmetic is pinned here against hand-computed figures rather than against
 * whatever the implementation happens to return.
 *
 * The slab table below is the shape a pinned `country_pack_versions.rules`
 * supplies; the expected values are computed by hand in each test's comment so
 * a future rule change cannot quietly redefine "correct".
 */

const RULES = {
  income_tax: {
    new_regime_slabs: [
      { upto: 300_000, rate: 0 },
      { upto: 600_000, rate: 5 },
      { upto: 900_000, rate: 10 },
      { upto: 1_200_000, rate: 15 },
      { upto: 1_500_000, rate: 20 },
      { upto: null, rate: 30 },
    ],
    standard_deduction_salary: 50_000,
    rebate_87a_new_regime_upto: 700_000,
  },
  tds: {
    sections: {
      "194C": { threshold_single: 30_000, rate_individual: 1, rate_other: 2 },
      "194J": { threshold: 30_000, rate: 10 },
      "194H": { threshold: 0, rate: 5 },
    },
  },
  payroll: {
    pf_employee_rate: 12,
    pf_employer_rate: 12,
    esi_wage_ceiling: 21_000,
    esi_employee_rate: 0.75,
    esi_employer_rate: 3.25,
  },
};

describe("income tax, new regime — progressive slabs", () => {
  it("taxes only the income inside each slab when income lands MID-slab", () => {
    // gross 1,050,000 − 50,000 standard deduction = 1,000,000 taxable.
    //   0–300,000     @ 0%  =      0
    //   300,000–600,000 @ 5%  = 15,000
    //   600,000–900,000 @10%  = 30,000
    //   900,000–1,000,000 @15% = 15,000   ← partially filled slab
    //                            -------
    //                            60,000
    const r = calcIncomeTaxNewRegime(RULES, { gross_salary: 1_050_000 });
    expect(r.taxable_income).toBe(1_000_000);
    expect(r.tax_before_rebate).toBe(60_000);
    expect(r.tax_payable).toBe(60_000);
  });

  it("is exact on a slab boundary", () => {
    // 650,000 − 50,000 = 600,000 taxable → 0 + 5% of 300,000 = 15,000.
    const r = calcIncomeTaxNewRegime(RULES, { gross_salary: 650_000 });
    expect(r.taxable_income).toBe(600_000);
    expect(r.tax_before_rebate).toBe(15_000);
  });

  it("charges nothing inside the zero-rate slab", () => {
    // 320,000 − 50,000 = 270,000 taxable, entirely within the 0% band.
    const r = calcIncomeTaxNewRegime(RULES, { gross_salary: 320_000 });
    expect(r.taxable_income).toBe(270_000);
    expect(r.tax_before_rebate).toBe(0);
    expect(r.tax_payable).toBe(0);
  });

  it("applies the 87A rebate at or below the threshold, cancelling the tax", () => {
    // 750,000 − 50,000 = 700,000 taxable (exactly the rebate ceiling).
    //   300,000–600,000 @5%  = 15,000
    //   600,000–700,000 @10% = 10,000  → 25,000 before rebate, 0 payable.
    const r = calcIncomeTaxNewRegime(RULES, { gross_salary: 750_000 });
    expect(r.taxable_income).toBe(700_000);
    expect(r.tax_before_rebate).toBe(25_000);
    expect(r.rebate_87a).toBe(25_000);
    expect(r.tax_payable).toBe(0);
  });

  it("withdraws the rebate one rupee above the ceiling", () => {
    // 750,001 − 50,000 = 700,001 taxable → rebate no longer applies.
    const r = calcIncomeTaxNewRegime(RULES, { gross_salary: 750_001 });
    expect(r.rebate_87a).toBe(0);
    expect(r.tax_payable).toBe(r.tax_before_rebate);
  });

  it("taxes the open-ended top slab at 30%", () => {
    // 2,050,000 − 50,000 = 2,000,000 taxable.
    //   0 + 15,000 + 30,000 + 45,000 + 60,000 = 150,000 up to 1,500,000
    //   remaining 500,000 @30% = 150,000  → 300,000
    const r = calcIncomeTaxNewRegime(RULES, { gross_salary: 2_050_000 });
    expect(r.taxable_income).toBe(2_000_000);
    expect(r.tax_before_rebate).toBe(300_000);
  });

  it("adds other income to the salary before applying slabs", () => {
    // 600,000 + 450,000 − 50,000 = 1,000,000 taxable → 60,000, as above.
    const r = calcIncomeTaxNewRegime(RULES, {
      gross_salary: 600_000,
      other_income: 450_000,
    });
    expect(r.taxable_income).toBe(1_000_000);
    expect(r.tax_before_rebate).toBe(60_000);
  });

  it("never produces negative taxable income", () => {
    const r = calcIncomeTaxNewRegime(RULES, { gross_salary: 20_000 });
    expect(r.taxable_income).toBe(0);
    expect(r.tax_payable).toBe(0);
  });

  it("returns zero rather than throwing when the pack has no slabs", () => {
    const r = calcIncomeTaxNewRegime({}, { gross_salary: 1_000_000 });
    expect(r.tax_payable).toBe(0);
  });
});

describe("TDS by section", () => {
  it("flags an unknown section instead of inventing a rate", () => {
    const r = calcTdsSection(RULES, { section: "999Z", amount: 100_000 });
    expect(r).toMatchObject({ tds: 0, rate: 0, unknown_section: true });
  });

  it("deducts nothing below a section threshold", () => {
    const r = calcTdsSection(RULES, { section: "194J", amount: 29_999 });
    expect(r).toMatchObject({ tds: 0, below_threshold: true });
  });

  it("deducts at the section rate once the threshold is met", () => {
    // 194J at 10% of 50,000 = 5,000.
    expect(calcTdsSection(RULES, { section: "194J", amount: 50_000 })).toMatchObject({
      tds: 5_000,
      rate: 10,
    });
  });

  it("uses the individual rate for 194C when the payee is an individual", () => {
    // 1% of 100,000 = 1,000.
    expect(
      calcTdsSection(RULES, { section: "194C", payee_type: "individual", amount: 100_000 }),
    ).toMatchObject({ tds: 1_000, rate: 1 });
  });

  it("uses the other-payee rate for 194C otherwise", () => {
    // 2% of 100,000 = 2,000.
    expect(
      calcTdsSection(RULES, { section: "194C", payee_type: "company", amount: 100_000 }),
    ).toMatchObject({ tds: 2_000, rate: 2 });
  });

  it("honours the 194C single-payment threshold", () => {
    expect(calcTdsSection(RULES, { section: "194C", amount: 29_999 })).toMatchObject({
      tds: 0,
      below_threshold: true,
    });
  });

  it("applies a zero-threshold section from the first rupee", () => {
    // 194H has threshold 0 → 5% of 10,000 = 500.
    expect(calcTdsSection(RULES, { section: "194H", amount: 10_000 })).toMatchObject({
      tds: 500,
      rate: 5,
    });
  });
});

describe("payroll PF and ESI", () => {
  it("computes PF at 12% for both sides", () => {
    expect(calcPf(RULES, { wage: 25_000 })).toEqual({ employee: 3_000, employer: 3_000 });
  });

  it("covers ESI at or below the wage ceiling", () => {
    // 0.75% and 3.25% of 20,000 = 150 and 650.
    expect(calcEsi(RULES, { wage: 20_000 })).toEqual({
      employee: 150,
      employer: 650,
      covered: true,
    });
  });

  it("treats the ceiling itself as covered", () => {
    expect(calcEsi(RULES, { wage: 21_000 }).covered).toBe(true);
  });

  it("marks a wage above the ceiling as not covered, with no contribution", () => {
    expect(calcEsi(RULES, { wage: 21_001 })).toEqual({
      employee: 0,
      employer: 0,
      covered: false,
    });
  });
});

describe("runCalculator dispatch", () => {
  it("routes each known calculator id", () => {
    expect(runCalculator("payroll.pf", RULES, { wage: 25_000 })).toMatchObject({ employee: 3_000 });
    expect(
      runCalculator("income_tax.new_regime", RULES, { gross_salary: 1_050_000 }),
    ).toMatchObject({ tax_payable: 60_000 });
  });

  it("throws on an unknown calculator rather than returning a made-up result", () => {
    expect(() => runCalculator("nope", RULES, {})).toThrow(/Unknown calculator/);
  });
});

describe("compareExpected", () => {
  it("passes when every expected key matches", () => {
    expect(compareExpected({ a: 1, b: "x" }, { a: 1, b: "x", extra: 9 })).toEqual({
      pass: true,
      diffs: [],
    });
  });

  it("reports a numeric difference outside the tolerance", () => {
    const r = compareExpected({ tax: 60_000 }, { tax: 90_000 });
    expect(r.pass).toBe(false);
    expect(r.diffs[0]).toContain("expected 60000, got 90000");
  });

  it("accepts a numeric difference within the tolerance", () => {
    expect(compareExpected({ tax: 100 }, { tax: 101 }, 1).pass).toBe(true);
  });

  it("compares non-numeric values strictly", () => {
    expect(compareExpected({ covered: true }, { covered: false }).pass).toBe(false);
  });
});
