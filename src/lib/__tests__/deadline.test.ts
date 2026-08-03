import { describe, it, expect } from "vitest";
import {
  checkDeadline,
  shouldStartStep,
  stepsThatFit,
  type DeadlineState,
} from "../skills/deadline";

const start = new Date("2026-07-24T10:00:00.000Z");
const state = (deadlineMs: number): DeadlineState => ({
  startedAt: start,
  deadline: new Date(start.getTime() + deadlineMs),
});
const at = (ms: number) => new Date(start.getTime() + ms);

describe("checking time remaining", () => {
  it("reports remaining time and elapsed fraction", () => {
    const c = checkDeadline(state(10_000), at(2_500));
    expect(c.remainingMs).toBe(7_500);
    expect(c.withinDeadline).toBe(true);
    expect(c.fractionElapsed).toBeCloseTo(0.25, 6);
  });

  it("reports a passed deadline as negative remaining", () => {
    const c = checkDeadline(state(5_000), at(6_000));
    expect(c.remainingMs).toBe(-1_000);
    expect(c.withinDeadline).toBe(false);
  });

  it("marks invalid dates and reversed windows invalid", () => {
    expect(checkDeadline({ startedAt: new Date("invalid"), deadline: at(1000) }, at(0)).valid).toBe(
      false,
    );
    expect(checkDeadline(state(-1), at(0)).valid).toBe(false);
  });
});

/**
 * The rule: never start what can't finish. A step is stopped BEFORE it would
 * overrun, not after.
 */
describe("never starting a step that can't finish in time", () => {
  it("starts a step that comfortably fits", () => {
    const d = shouldStartStep(state(60_000), at(0), 10_000);
    expect(d.start).toBe(true);
  });

  it("refuses a step that wouldn't finish before the deadline", () => {
    // 5 s left, step needs 10 s.
    const d = shouldStartStep(state(60_000), at(55_000), 10_000);
    expect(d.start).toBe(false);
    if (d.start) throw new Error("unreachable");
    expect(d.reason).toMatch(/won't start work it can't finish in time/i);
    expect(d.shortByMs).toBeGreaterThan(0);
  });

  /**
   * The margin case: a step that would finish EXACTLY at the deadline is not
   * started, because the estimate might be slightly optimistic.
   */
  it("refuses a step that would finish only just in time (margin)", () => {
    // Exactly 10 s left, step estimated 10 s — no margin room.
    const d = shouldStartStep(state(60_000), at(50_000), 10_000);
    expect(d.start).toBe(false);
    if (d.start) throw new Error("unreachable");
    expect(d.reason).toMatch(/margin/i);
  });

  it("respects a custom margin", () => {
    // 11 s left, 10 s step, tiny 100ms margin → fits.
    const d = shouldStartStep(state(60_000), at(49_000), 10_000, 100);
    expect(d.start).toBe(true);
  });

  it("refuses invalid dates and an invalid custom margin", () => {
    expect(
      shouldStartStep({ startedAt: new Date("invalid"), deadline: at(60_000) }, at(0), 1000).start,
    ).toBe(false);
    expect(shouldStartStep(state(60_000), at(0), 1000, -1).start).toBe(false);
  });

  it("refuses once the deadline has passed, naming the overrun", () => {
    const d = shouldStartStep(state(10_000), at(12_000), 1_000);
    expect(d.start).toBe(false);
    if (d.start) throw new Error("unreachable");
    expect(d.reason).toMatch(/deadline has already passed/i);
  });

  it("refuses a step with no valid estimate rather than guessing it fits", () => {
    const d = shouldStartStep(state(60_000), at(0), NaN);
    expect(d.start).toBe(false);
    if (d.start) throw new Error("unreachable");
    expect(d.reason).toMatch(/no valid time estimate/i);
  });
});

describe("planning how many steps fit up front", () => {
  it("counts the steps that fit before the deadline", () => {
    // 30 s budget, steps of 10 s each (+10% margin = 11 s effective for the
    // gating check, but only the estimate is deducted).
    const fit = stepsThatFit(state(30_000), at(0), [10_000, 10_000, 10_000]);
    // Step1: need 11k ≤ 30k ✓, remaining 20k. Step2: need 11k ≤ 20k ✓, rem 10k.
    // Step3: need 11k > 10k ✗. So 2 fit.
    expect(fit).toBe(2);
  });

  it("returns zero when even the first step won't fit", () => {
    expect(stepsThatFit(state(5_000), at(0), [10_000])).toBe(0);
  });

  it("counts all when they all fit", () => {
    expect(stepsThatFit(state(100_000), at(0), [10_000, 10_000])).toBe(2);
  });

  it("returns zero for invalid windows or invalid step estimates", () => {
    expect(stepsThatFit(state(-1), at(0), [100])).toBe(0);
    expect(stepsThatFit(state(100_000), at(0), [100, Number.NaN, 100])).toBe(0);
  });
});
