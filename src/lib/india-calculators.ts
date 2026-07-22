/**
 * India country-pack — deterministic calculators.
 *
 * These are pure functions. AI never fills in numbers here. Each calculator
 * takes rule tables (from a pinned `country_pack_versions.rules`) plus inputs
 * and returns a fully computed result. Test cases in `historical_test_cases`
 * exercise them so a rule change cannot silently break FY history.
 */

type Slab = { upto: number | null; rate: number };
type Rules = Record<string, unknown>;

function round(n: number): number {
  return Math.round(n);
}

export function calcIncomeTaxNewRegime(
  rules: Rules,
  input: { gross_salary: number; other_income?: number },
) {
  const it = (rules as { income_tax?: Record<string, unknown> }).income_tax ?? {};
  const slabs = (it.new_regime_slabs as Slab[]) ?? [];
  const std = Number(it.standard_deduction_salary ?? 0);
  const rebateUpto = Number(it.rebate_87a_new_regime_upto ?? 0);

  const taxable = Math.max(
    0,
    (input.gross_salary ?? 0) + (input.other_income ?? 0) - std,
  );
  const remaining = taxable;
  let prev = 0;
  let tax = 0;
  for (const s of slabs) {
    const cap = s.upto ?? Infinity;
    const band = Math.max(0, Math.min(remaining, cap - prev));
    tax += (band * s.rate) / 100;
    prev = cap;
    if (taxable <= cap) break;
  }
  const rebate = taxable <= rebateUpto ? tax : 0;
  return {
    taxable_income: round(taxable),
    tax_before_rebate: round(tax),
    rebate_87a: round(rebate),
    tax_payable: round(tax - rebate),
  };
}

export function calcTdsSection(
  rules: Rules,
  input: { section: string; payee_type?: string; amount: number },
) {
  const tds = (rules as { tds?: { sections?: Record<string, any> } }).tds ?? {};
  const sec = tds.sections?.[input.section];
  if (!sec) return { tds: 0, rate: 0, unknown_section: true };
  const amount = input.amount ?? 0;

  // 194C uses individual vs other rate + thresholds
  if (input.section === "194C") {
    const threshold = Number(sec.threshold_single ?? 0);
    if (amount < threshold) return { tds: 0, rate: 0, below_threshold: true };
    const rate =
      input.payee_type === "individual"
        ? Number(sec.rate_individual ?? 1)
        : Number(sec.rate_other ?? 2);
    return { tds: round((amount * rate) / 100), rate };
  }

  const threshold = Number(sec.threshold ?? 0);
  if (threshold && amount < threshold) {
    return { tds: 0, rate: 0, below_threshold: true };
  }
  const rate = Number(sec.rate ?? 0);
  return { tds: round((amount * rate) / 100), rate };
}

export function calcPf(rules: Rules, input: { wage: number }) {
  const p = (rules as { payroll?: Record<string, unknown> }).payroll ?? {};
  const eRate = Number(p.pf_employee_rate ?? 12);
  const rRate = Number(p.pf_employer_rate ?? 12);
  return {
    employee: round((input.wage * eRate) / 100),
    employer: round((input.wage * rRate) / 100),
  };
}

export function calcEsi(rules: Rules, input: { wage: number }) {
  const p = (rules as { payroll?: Record<string, unknown> }).payroll ?? {};
  const ceiling = Number(p.esi_wage_ceiling ?? 21000);
  const eRate = Number(p.esi_employee_rate ?? 0.75);
  const rRate = Number(p.esi_employer_rate ?? 3.25);
  if (input.wage > ceiling) {
    return { employee: 0, employer: 0, covered: false };
  }
  return {
    employee: round((input.wage * eRate) / 100),
    employer: round((input.wage * rRate) / 100),
    covered: true,
  };
}

export type CalculatorId =
  | "income_tax.new_regime"
  | "tds.section"
  | "payroll.pf"
  | "payroll.esi";

export function runCalculator(
  calc: string,
  rules: Rules,
  inputs: Record<string, unknown>,
): Record<string, unknown> {
  switch (calc) {
    case "income_tax.new_regime":
      return calcIncomeTaxNewRegime(rules, inputs as any);
    case "tds.section":
      return calcTdsSection(rules, inputs as any);
    case "payroll.pf":
      return calcPf(rules, inputs as any);
    case "payroll.esi":
      return calcEsi(rules, inputs as any);
    default:
      throw new Error(`Unknown calculator: ${calc}`);
  }
}

/** Deterministic deep-equal comparison for test-case expected vs actual. */
export function compareExpected(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
  tolerance = 0,
): { pass: boolean; diffs: string[] } {
  const diffs: string[] = [];
  for (const k of Object.keys(expected)) {
    const e = (expected as any)[k];
    const a = (actual as any)[k];
    if (typeof e === "number" && typeof a === "number") {
      if (Math.abs(e - a) > tolerance) diffs.push(`${k}: expected ${e}, got ${a}`);
    } else if (e !== a) {
      diffs.push(`${k}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
    }
  }
  return { pass: diffs.length === 0, diffs };
}
