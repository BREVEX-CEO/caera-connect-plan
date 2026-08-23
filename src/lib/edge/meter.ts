/**
 * What an answer actually cost — in money, energy and time.
 *
 * When the compute is yours, the arithmetic is yours too. A local answer costs
 * electricity and nothing else, and that is a number this can actually derive:
 * measured wall-clock time, a declared power draw for the machine class, and
 * the user's own tariff.
 *
 * WHY THIS IS A FEATURE AND NOT A GIMMICK. It reframes the product's central
 * claim from a slogan into arithmetic. "Unlimited local use" is marketing;
 * "this conversation cost 0.03 p and stayed on this device" is a fact the user
 * can check against their own electricity bill and the runtime receipt.
 *
 * EVERY FIGURE IS LABELLED. Power draw is a class estimate, not a measurement —
 * browsers cannot read a wattmeter. The interface says "estimated" and shows
 * the assumption, because a precise-looking number derived from a guess is
 * worse than an honest range.
 */

/** Rough sustained draw while generating, by machine class, in watts. */
export const POWER_CLASS = {
  phone: 4,
  laptop_integrated: 22,
  laptop_discrete: 65,
  desktop_discrete: 180,
} as const;

export type PowerClass = keyof typeof POWER_CLASS;

export interface RunCost {
  where: "local";
  durationMs: number;
  /** Tokens produced, when the engine reports them. */
  outputTokens: number | null;
  /** Tokens per second, or null when unknown. */
  tokensPerSecond: number | null;
  /** Watt-hours, estimated from the declared device class. */
  energyWh: number;
  /** Money, in the smallest unit of the given currency. Local is always 0. */
  costMinor: number;
  currency: string;
}

export interface MeterInputs {
  durationMs: number;
  outputTokens?: number | null;
  powerClass?: PowerClass;
  /** Electricity price in minor units per kWh, e.g. 28 for 28p/kWh. */
  tariffMinorPerKwh?: number;
  currency?: string;
}

export function measureRun(input: MeterInputs): RunCost {
  const seconds = Math.max(0, input.durationMs) / 1000;
  const tokens = input.outputTokens ?? null;
  const tokensPerSecond = tokens !== null && seconds > 0 ? tokens / seconds : null;

  const watts = POWER_CLASS[input.powerClass ?? "laptop_integrated"];
  const energyWh = (watts * seconds) / 3600;
  const tariff = input.tariffMinorPerKwh ?? 28;
  const costMinor = (energyWh / 1000) * tariff;

  return {
    where: "local",
    durationMs: input.durationMs,
    outputTokens: tokens,
    tokensPerSecond,
    energyWh,
    costMinor,
    currency: input.currency ?? "GBP",
  };
}

export interface Totals {
  runs: number;
  local: number;
  energyWh: number;
  costMinor: number;
  currency: string;
}

export function total(runs: readonly RunCost[]): Totals {
  return {
    runs: runs.length,
    local: runs.length,
    energyWh: runs.reduce((n, r) => n + r.energyWh, 0),
    costMinor: runs.reduce((n, r) => n + r.costMinor, 0),
    currency: runs[0]?.currency ?? "GBP",
  };
}

/** Money, at a precision that does not pretend to more accuracy than it has. */
export function formatCost(minor: number, currency: string): string {
  const symbol = currency === "GBP" ? "p" : "";
  if (minor < 0.01) return `under 0.01${symbol || " " + currency}`;
  if (minor < 1) return `${minor.toFixed(2)}${symbol || " " + currency}`;
  return symbol === "p"
    ? `£${(minor / 100).toFixed(2)}`
    : `${(minor / 100).toFixed(2)} ${currency}`;
}

/** Energy in units a person can picture. */
export function formatEnergy(wh: number): string {
  if (wh < 0.001) return "under 0.001 Wh";
  if (wh < 1) return `${wh.toFixed(3)} Wh`;
  return `${wh.toFixed(2)} Wh`;
}

/**
 * What this conversation actually cost, on this machine.
 *
 * What a person can act on is what their own hardware did, so that is what is
 * reported — and the honest limit of it is stated in `energyAssumption`.
 */
export function describeTotals(totals: Totals): string {
  if (totals.runs === 0) return "Nothing has been asked yet in this conversation.";
  if (totals.local === 0)
    return "Nothing has been generated on this device yet in this conversation.";
  return (
    `${totals.local} ${totals.local === 1 ? "answer" : "answers"} ran on your own hardware, ` +
    `using about ${formatEnergy(totals.energyWh)} of electricity — roughly ` +
    `${formatCost(totals.costMinor, totals.currency)}. Nothing was metered and nothing left this device.`
  );
}

/** The assumption behind the energy figure, shown wherever it is. */
export function energyAssumption(powerClass: PowerClass, tariffMinorPerKwh: number): string {
  return `Estimated from ${POWER_CLASS[powerClass]} W while generating at ${tariffMinorPerKwh}p per kWh. Browsers cannot read a power meter, so this is a class estimate rather than a measurement.`;
}
