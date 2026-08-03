import { describe, it, expect } from "vitest";
import { WorldScan, MIN_INTERVAL_MS, type CreateMonitorInput } from "../research/world-scan";

const NOW = new Date("2026-07-24T12:00:00Z");

const create = (scan: WorldScan, over: Partial<CreateMonitorInput> = {}) =>
  scan.create({
    id: "m1",
    topic: "market",
    subject: "ACME share price",
    sources: ["exchange feed"],
    intervalMs: MIN_INTERVAL_MS.market,
    now: NOW,
    ...over,
  });

describe("monitoring is opt-in and source-cited", () => {
  it("creates a monitor the user asked for", () => {
    const scan = new WorldScan();
    const r = create(scan);
    expect(r.ok).toBe(true);
    expect(scan.list()).toHaveLength(1);
  });

  it("starts with nothing monitored", () => {
    expect(new WorldScan().list()).toEqual([]);
  });

  /** An alert you can't trace is a rumour. */
  it("refuses a monitor with no source", () => {
    const r = create(new WorldScan(), { sources: [] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/can't trace back/i);
  });

  it("refuses an empty subject and a duplicate id", () => {
    const scan = new WorldScan();
    expect(create(scan, { subject: "  " }).ok).toBe(false);
    create(scan);
    expect(create(scan).ok).toBe(false);
  });
});

describe("the rate limit cannot be configured away", () => {
  /**
   * A requested interval below the topic floor is raised, never honoured — so
   * an over-eager schedule can't hammer a source.
   */
  it("raises a too-fast interval to the topic floor", () => {
    const scan = new WorldScan();
    const r = create(scan, { topic: "regulation", intervalMs: 1000 });
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.intervalMs).toBe(MIN_INTERVAL_MS.regulation);
    expect(r.evidence).toMatch(/raised to the .* floor/i);
  });

  it("keeps a slower-than-floor interval as requested", () => {
    const scan = new WorldScan();
    const slow = MIN_INTERVAL_MS.market * 10;
    const r = create(scan, { intervalMs: slow });
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.intervalMs).toBe(slow);
  });

  it("does not report a monitor due before its interval elapses", () => {
    const scan = new WorldScan();
    create(scan, { intervalMs: MIN_INTERVAL_MS.market });
    // Never checked → due immediately.
    expect(scan.dueChecks(NOW)).toHaveLength(1);

    scan.markChecked("m1", NOW);
    // Just checked → not due.
    expect(scan.dueChecks(NOW)).toHaveLength(0);
    // Half an interval later → still not due.
    expect(scan.dueChecks(new Date(NOW.getTime() + MIN_INTERVAL_MS.market / 2))).toHaveLength(0);
    // A full interval later → due again.
    expect(scan.dueChecks(new Date(NOW.getTime() + MIN_INTERVAL_MS.market))).toHaveLength(1);
  });
});

describe("pause, resume, and revoke", () => {
  it("a paused monitor is never due", () => {
    const scan = new WorldScan();
    create(scan);
    scan.pause("m1");
    expect(scan.dueChecks(new Date(NOW.getTime() + 86_400_000))).toHaveLength(0);
  });

  it("resume brings it back", () => {
    const scan = new WorldScan();
    create(scan);
    scan.pause("m1");
    scan.resume("m1");
    expect(scan.dueChecks(NOW)).toHaveLength(1);
  });

  /** Revoke genuinely removes it; a revoked monitor can never be due again. */
  it("revoke removes the monitor entirely", () => {
    const scan = new WorldScan();
    create(scan);
    const r = scan.revoke("m1");
    expect(r.ok).toBe(true);
    expect(scan.list()).toHaveLength(0);
    expect(scan.dueChecks(new Date(NOW.getTime() + 86_400_000))).toHaveLength(0);
  });

  it("revoking distinguishes from pausing — it can't be resumed", () => {
    const scan = new WorldScan();
    create(scan);
    scan.revoke("m1");
    expect(scan.resume("m1").ok).toBe(false);
  });

  it("reports honestly when revoking something absent", () => {
    const r = new WorldScan().revoke("ghost");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/nothing was revoked/i);
  });
});

describe("due-check scheduling across several monitors", () => {
  it("reports only the monitors whose interval has elapsed", () => {
    const scan = new WorldScan();
    create(scan, { id: "fast", topic: "market", intervalMs: MIN_INTERVAL_MS.market });
    create(scan, { id: "slow", topic: "regulation", intervalMs: MIN_INTERVAL_MS.regulation });
    scan.markChecked("fast", NOW);
    scan.markChecked("slow", NOW);

    // 2 minutes later: neither elapsed (market floor is 1 min... actually elapsed).
    const twoMin = new Date(NOW.getTime() + 2 * 60_000);
    const due = scan.dueChecks(twoMin).map((m) => m.id);
    expect(due).toContain("fast"); // 1-min market interval elapsed
    expect(due).not.toContain("slow"); // 1-day regulation interval not elapsed
  });
});

describe("persistence round-trips and re-applies the rate floor", () => {
  it("round-trips monitors through JSON", () => {
    const scan = new WorldScan();
    create(scan, { id: "m1" });
    scan.pause("m1");
    const restored = WorldScan.fromJSON(JSON.parse(JSON.stringify(scan.toJSON())));
    expect(restored.list()).toHaveLength(1);
    expect(restored.list()[0].state).toBe("paused");
  });

  /** A value tampered below the floor in storage can't survive a reload. */
  it("re-applies the rate floor on rehydrate", () => {
    const tampered = [
      {
        id: "x",
        topic: "regulation",
        subject: "s",
        sources: ["gov"],
        intervalMs: 1000,
        state: "active",
        createdAt: NOW.toISOString(),
        lastCheckedAt: null,
      },
    ];
    const restored = WorldScan.fromJSON(tampered);
    expect(restored.list()[0].intervalMs).toBe(MIN_INTERVAL_MS.regulation);
  });

  it("drops malformed or source-less entries on rehydrate", () => {
    const restored = WorldScan.fromJSON([
      null,
      {
        id: "ok",
        topic: "market",
        subject: "s",
        sources: ["feed"],
        intervalMs: MIN_INTERVAL_MS.market,
        state: "active",
        createdAt: NOW.toISOString(),
        lastCheckedAt: null,
      },
      { id: "nosrc", topic: "market", subject: "s", sources: [] },
      "garbage",
    ]);
    expect(restored.list().map((m) => m.id)).toEqual(["ok"]);
  });

  it("returns an empty scan for non-array input", () => {
    expect(WorldScan.fromJSON("nope").list()).toEqual([]);
  });
});
