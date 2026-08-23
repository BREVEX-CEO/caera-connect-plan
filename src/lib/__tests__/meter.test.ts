import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  measureRun,
  total,
  formatCost,
  formatEnergy,
  describeTotals,
  energyAssumption,
  POWER_CLASS,
} from "../edge/meter";

/**
 * The meter turns the product's central claim into arithmetic.
 *
 * "Unlimited local use" is a slogan. "This conversation cost 0.03p of
 * electricity and none of your 28 cloud requests" is a fact the user can check
 * against their own bill. The tests below defend the two ways that could become
 * dishonest: overstating what local costs, and understating what cloud costs.
 */

describe("local work is not metered", () => {
  it("consumes no allowance", () => {
    const run = measureRun({ where: "local", durationMs: 5_000, outputTokens: 200 });
    // The claim the whole product rests on, expressed as a number.
    expect(run.allowanceUsed).toBe(0);
  });

  it("costs electricity and nothing else", () => {
    const run = measureRun({
      where: "local",
      durationMs: 10_000,
      powerClass: "laptop_integrated",
      tariffMinorPerKwh: 28,
    });
    // 22 W for 10 s = 0.0611 Wh; at 28p/kWh that is ~0.0017p.
    expect(run.energyWh).toBeCloseTo((22 * 10) / 3600, 5);
    expect(run.costMinor).toBeGreaterThan(0);
    expect(run.costMinor).toBeLessThan(0.01);
  });

  it("scales with the machine class", () => {
    const laptop = measureRun({
      where: "local",
      durationMs: 10_000,
      powerClass: "laptop_integrated",
    });
    const desktop = measureRun({
      where: "local",
      durationMs: 10_000,
      powerClass: "desktop_discrete",
    });
    expect(desktop.energyWh!).toBeGreaterThan(laptop.energyWh!);
    // A phone is the cheapest to run and the slowest — both are true and both
    // are reported rather than one being hidden.
    expect(POWER_CLASS.phone).toBeLessThan(POWER_CLASS.laptop_integrated);
  });

  it("reports throughput when tokens are known", () => {
    const run = measureRun({ where: "local", durationMs: 4_000, outputTokens: 100 });
    expect(run.tokensPerSecond).toBeCloseTo(25, 5);
  });

  it("reports null throughput rather than zero when tokens are unknown", () => {
    // Zero tokens per second reads as "it produced nothing", which is a
    // different and wrong claim.
    const run = measureRun({ where: "local", durationMs: 4_000 });
    expect(run.tokensPerSecond).toBeNull();
  });
});

describe("cloud work is metered, and its energy is unknown", () => {
  it("spends one request", () => {
    expect(measureRun({ where: "cloud", durationMs: 900 }).allowanceUsed).toBe(1);
  });

  it("reports energy as unknown, not zero", () => {
    /*
     * A cloud answer certainly consumed energy, in a datacentre, on hardware we
     * know nothing about. Reporting 0 would imply local compute is dirtier than
     * cloud — the opposite of what the arithmetic shows, and a lie by omission
     * that happens to flatter the cloud path.
     */
    const run = measureRun({ where: "cloud", durationMs: 900 });
    expect(run.energyWh).toBeNull();
    expect(run.costMinor).toBe(0);
  });
});

describe("totals add up across a conversation", () => {
  it("separates local from cloud", () => {
    const totals = total([
      measureRun({ where: "local", durationMs: 5_000 }),
      measureRun({ where: "local", durationMs: 5_000 }),
      measureRun({ where: "cloud", durationMs: 800 }),
    ]);
    expect(totals.runs).toBe(3);
    expect(totals.local).toBe(2);
    expect(totals.cloud).toBe(1);
    expect(totals.allowanceUsed).toBe(1);
  });

  it("does not let unknown cloud energy contaminate the total", () => {
    const totals = total([
      measureRun({ where: "local", durationMs: 3_600_000, powerClass: "laptop_integrated" }),
      measureRun({ where: "cloud", durationMs: 800 }),
    ]);
    // 22 W for one hour is 22 Wh, and the cloud run adds nothing it cannot know.
    expect(totals.energyWh).toBeCloseTo(22, 3);
  });

  it("reports what this device did, with no allowance to compare against", () => {
    const totals = total([
      measureRun({ where: "local", durationMs: 5_000 }),
      measureRun({ where: "local", durationMs: 5_000 }),
    ]);
    const text = describeTotals(totals);
    expect(text).toMatch(/2 answers ran on your own hardware/i);
    expect(text).toMatch(/nothing was metered and nothing left this device/i);
    /*
     * These two assertions are inverted from what they were, deliberately.
     * The line used to end "...and none of your cloud allowance" and
     * "The same conversation on a cloud-only assistant would have used 2 of
     * 28" — both describing a metered service OCADE no longer has, and the
     * second being a claim about a competitor rather than about this machine.
     */
    expect(text).not.toMatch(/allowance/i);
    expect(text).not.toMatch(/would have used/i);
    expect(text).not.toMatch(/cloud/i);
  });

  it("says nothing has happened rather than reporting zeroes", () => {
    expect(describeTotals(total([]))).toMatch(/nothing has been asked/i);
  });
});

describe("figures are formatted without false precision", () => {
  it("does not print a misleading 0.00", () => {
    // Rounding a real cost to zero would turn "almost free" into "free", which
    // is the kind of small lie that makes the rest untrustworthy.
    expect(formatCost(0.001, "GBP")).toMatch(/under 0\.01/);
  });

  it("switches to pounds once pence get unwieldy", () => {
    expect(formatCost(250, "GBP")).toBe("£2.50");
    expect(formatCost(0.4, "GBP")).toBe("0.40p");
  });

  it("formats energy at a readable scale", () => {
    expect(formatEnergy(0.0001)).toMatch(/under 0\.001/);
    expect(formatEnergy(0.061)).toBe("0.061 Wh");
    expect(formatEnergy(22)).toBe("22.00 Wh");
  });

  it("shows the assumption behind the estimate", () => {
    const text = energyAssumption("laptop_integrated", 28);
    expect(text).toMatch(/22 W/);
    expect(text).toMatch(/28p per kWh/);
    // The honest admission that this is derived, not measured.
    expect(text).toMatch(/cannot read a power meter/i);
  });
});

describe("degenerate input does not produce nonsense", () => {
  it("treats a negative duration as zero", () => {
    const run = measureRun({ where: "local", durationMs: -500 });
    expect(run.energyWh).toBe(0);
    expect(run.costMinor).toBe(0);
  });

  it("does not divide by zero on an instant run", () => {
    const run = measureRun({ where: "local", durationMs: 0, outputTokens: 10 });
    expect(run.tokensPerSecond).toBeNull();
  });
});

describe("the signed-in chat meters its own conversation", () => {
  /**
   * More meaningful here than in the demo, because this surface has a REAL
   * allowance to compare against. "0 of your 28 cloud requests, and about
   * 0.02p of electricity" is checkable against the user's own usage page and
   * their own bill — which is the honest form of the claim the product rests
   * on, as opposed to the word "unlimited".
   */
  const CHAT = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");

  function code(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  }

  it("records a cost for each answer", () => {
    expect(code(CHAT)).toMatch(/measureRun\(\{/);
  });

  it("derives it from the receipt, not from the code branch", () => {
    /*
     * THE TRAP. This is the on-device path, so recording "local"
     * unconditionally is the obvious move — and then a cost line saying "free,
     * no allowance used" can sit directly beneath a receipt reporting that
     * data left. Reading the measurement keeps them consistent by construction
     * rather than by discipline.
     */
    const c = code(CHAT).replace(/\s+/g, " ");
    expect(c).toMatch(/where: receipt\.leftDevice \? "cloud" : "local"/);
    expect(c, "the cost was hardcoded to local").not.toMatch(/measureRun\(\{ where: "local"/);
  });

  it("meters this device only, with no payment constant coupled into Chat", () => {
    /*
     * This asserted `describeTotals(totalCost(costs), CLOUD_ALLOWANCE)` — that
     * the allowance came from the pricing module rather than a literal, which
     * was the right check while a metered cloud engine existed. It does not,
     * so the assertion is inverted: Chat must not import a payment constant at
     * all, and the meter takes one argument.
     */
    const c = code(CHAT);
    expect(c).toMatch(/describeTotals\(totalCost\(costs\)\)/);
    expect(c).not.toMatch(/CLOUD_ALLOWANCE/);
    expect(c).not.toMatch(/payments\/pricing/);
  });

  it("clears the tally when the conversation changes", () => {
    // Carrying it across would attribute one conversation's electricity to
    // another.
    const c = code(CHAT);
    const effect = c.slice(c.indexOf("ledgerRef.current = [];"));
    expect(effect.slice(0, 340)).toMatch(/setCosts\(\[\]\)/);
  });

  it("shows nothing until there is something real to report", () => {
    // A running total of zero is noise on every empty conversation.
    expect(code(CHAT)).toMatch(/costs\.length > 0 \?/);
  });
});
