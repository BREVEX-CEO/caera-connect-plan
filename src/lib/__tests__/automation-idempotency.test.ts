import { describe, it, expect } from "vitest";
import {
  IN_FLIGHT_STATUSES,
  isInFlight,
  nextRunAt,
  type Automation,
  type RunStatus,
} from "../ocade-automations";

/**
 * PROOF OF NO DOUBLE EXECUTION.
 *
 * `startAutomationRun` cannot be imported here — it is a `createServerFn` bound
 * to Supabase. What CAN be proven is the algorithm it implements, exercised
 * against a fake store that reproduces the two ways a duplicate arises:
 *
 *   1. sequential   — a double-click, or a scheduler tick landing on a manual run
 *   2. simultaneous — two servers/tabs passing the read check before either writes
 *
 * Case 1 is stopped by the application guard. Case 2 is NOT — only the database
 * can settle it, which is why the migration carries a partial unique index. The
 * fake store below enforces that index, so the test proves BOTH layers.
 */

interface Run {
  id: string;
  automationId: string;
  status: RunStatus;
  dryRun: boolean;
}

/** Reproduces `ocade_automation_runs` + the partial unique index. */
class FakeRunStore {
  private rows: Run[] = [];
  private seq = 0;

  all(): Run[] {
    return [...this.rows];
  }

  /** Mirrors: UNIQUE (automation_id) WHERE dry_run = false AND status IN (...) */
  private violatesIndex(automationId: string, dryRun: boolean, status: RunStatus): boolean {
    if (dryRun || !isInFlight(status)) return false;
    return this.rows.some(
      (r) => r.automationId === automationId && !r.dryRun && isInFlight(r.status),
    );
  }

  insert(automationId: string, status: RunStatus, dryRun: boolean): Run {
    if (this.violatesIndex(automationId, dryRun, status)) {
      throw new Error(
        'duplicate key value violates unique constraint "ocade_automation_runs_one_in_flight_idx"',
      );
    }
    const row: Run = { id: `run-${++this.seq}`, automationId, status, dryRun };
    this.rows.push(row);
    return row;
  }

  findInFlight(automationId: string): Run | undefined {
    return this.rows.find(
      (r) => r.automationId === automationId && !r.dryRun && isInFlight(r.status),
    );
  }

  setStatus(id: string, status: RunStatus): void {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.status = status;
  }
}

/** The handler's algorithm: check for an in-flight run, else insert. */
function startRun(store: FakeRunStore, automationId: string, opts: { dryRun?: boolean } = {}): Run {
  const dryRun = opts.dryRun ?? false;
  if (!dryRun) {
    const active = store.findInFlight(automationId);
    if (active) return active; // idempotent — returns the SAME run
  }
  return store.insert(automationId, dryRun ? "succeeded" : "pending", dryRun);
}

describe("layer 1 — the application guard (sequential duplicates)", () => {
  it("a second start returns the SAME run rather than creating another", () => {
    const store = new FakeRunStore();
    const first = startRun(store, "a1");
    const second = startRun(store, "a1");

    expect(second.id).toBe(first.id);
    expect(store.all()).toHaveLength(1);
  });

  it("survives a rapid double-click without erroring at the user", () => {
    const store = new FakeRunStore();
    const ids = Array.from({ length: 10 }, () => startRun(store, "a1").id);
    expect(new Set(ids).size).toBe(1);
    expect(store.all()).toHaveLength(1);
  });

  it("the scheduler tick landing on a manual run does not double-start", () => {
    const store = new FakeRunStore();
    const manual = startRun(store, "a1"); // user pressed Run now
    const scheduled = startRun(store, "a1"); // 60s tick fires
    expect(scheduled.id).toBe(manual.id);
    expect(store.all()).toHaveLength(1);
  });

  it("different automations are independent", () => {
    const store = new FakeRunStore();
    startRun(store, "a1");
    startRun(store, "a2");
    expect(store.all()).toHaveLength(2);
  });
});

describe("layer 2 — the database index (simultaneous duplicates)", () => {
  /**
   * Both callers read BEFORE either writes, so both see no in-flight run and
   * both attempt an insert. The application guard cannot prevent this; the
   * partial unique index must.
   */
  it("the loser of a genuine race gets a unique violation, not a duplicate run", () => {
    const store = new FakeRunStore();

    // Interleaved: both check first.
    const aSawActive = store.findInFlight("a1");
    const bSawActive = store.findInFlight("a1");
    expect(aSawActive).toBeUndefined();
    expect(bSawActive).toBeUndefined();

    store.insert("a1", "pending", false); // A wins
    expect(() => store.insert("a1", "pending", false)).toThrow(/unique constraint/i);

    expect(store.all()).toHaveLength(1);
  });

  it("names the index, so a failure is diagnosable in production logs", () => {
    const store = new FakeRunStore();
    store.insert("a1", "running", false);
    expect(() => store.insert("a1", "running", false)).toThrow(
      /ocade_automation_runs_one_in_flight_idx/,
    );
  });

  it.each(IN_FLIGHT_STATUSES)("blocks a second run while the first is %s", (status) => {
    const store = new FakeRunStore();
    store.insert("a1", status, false);
    expect(() => store.insert("a1", "pending", false)).toThrow(/unique constraint/i);
  });
});

describe("what must NOT be blocked", () => {
  it.each(["succeeded", "failed", "cancelled", "blocked"] as const)(
    "allows a new run once the previous one is %s",
    (status) => {
      const store = new FakeRunStore();
      const first = store.insert("a1", "pending", false);
      store.setStatus(first.id, status);

      const second = startRun(store, "a1");
      expect(second.id).not.toBe(first.id);
      expect(store.all()).toHaveLength(2);
    },
  );

  /** A blocked run never executes — leaving it in flight would wedge the automation. */
  it("a blocked run does not wedge the automation forever", () => {
    const store = new FakeRunStore();
    const first = store.insert("a1", "pending", false);
    store.setStatus(first.id, "blocked");
    expect(() => startRun(store, "a1")).not.toThrow();
  });

  it("dry runs are exempt — previewing repeatedly never blocks a real run", () => {
    const store = new FakeRunStore();
    startRun(store, "a1"); // a real run is in flight
    startRun(store, "a1", { dryRun: true });
    startRun(store, "a1", { dryRun: true });
    startRun(store, "a1", { dryRun: true });

    const real = store.all().filter((r) => !r.dryRun);
    expect(real).toHaveLength(1);
    expect(store.all().filter((r) => r.dryRun)).toHaveLength(3);
  });

  it("a real run can still start while only dry runs exist", () => {
    const store = new FakeRunStore();
    startRun(store, "a1", { dryRun: true });
    expect(() => startRun(store, "a1")).not.toThrow();
    expect(store.all().filter((r) => !r.dryRun)).toHaveLength(1);
  });
});

/**
 * RUNAWAY-REPEAT GUARD.
 *
 * `startAutomationRun` used to record only `last_run_at`, leaving `next_run_at`
 * permanently in the past once an automation first became due. The scheduler
 * reads that column, so the automation fired, finished, and fired again on the
 * very next 60s tick — an "every 24 hours" schedule ran every minute. The
 * in-flight guard prevented CONCURRENT runs, so it surfaced as a runaway series
 * of sequential runs rather than an obvious error.
 */
describe("a run advances its own schedule", () => {
  const every24h: Automation = {
    id: "a1",
    name: "Daily digest",
    enabled: true,
    trigger: { kind: "interval", everyMinutes: 60 * 24 },
    actions: [],
    requiresApproval: false,
    dryRun: false,
    maxAttempts: 3,
  };

  it("moves next_run_at into the FUTURE after a run starts", () => {
    const startedAt = new Date("2026-07-23T10:00:00Z");
    const next = nextRunAt(every24h.trigger, startedAt, startedAt);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(startedAt.getTime());
  });

  it("advances by the configured interval, not by the tick period", () => {
    const startedAt = new Date("2026-07-23T10:00:00Z");
    const next = nextRunAt(every24h.trigger, startedAt, startedAt);
    const deltaMinutes = (next!.getTime() - startedAt.getTime()) / 60000;
    expect(deltaMinutes).toBe(60 * 24);
    // The bug made this effectively 1 minute.
    expect(deltaMinutes).not.toBe(1);
  });

  it("the freshly advanced time is NOT due at the next tick", () => {
    const startedAt = new Date("2026-07-23T10:00:00Z");
    const next = nextRunAt(every24h.trigger, startedAt, startedAt)!;
    const oneTickLater = new Date(startedAt.getTime() + 60_000);
    expect(next.getTime() > oneTickLater.getTime()).toBe(true);
  });

  it("a manual automation has no next run, so it never self-fires", () => {
    expect(nextRunAt({ kind: "manual" }, new Date(), new Date())).toBeNull();
  });

  it("the server path uses the atomic enqueue RPC instead of split insert and update calls", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("src/lib/ocade-automations.functions.ts", "utf8");
    const handler =
      /export const startAutomationRun[\s\S]*?export const listAutomationRuns/.exec(source)?.[0] ??
      "";
    expect(handler).toContain('"ocade_enqueue_automation_run"');
    expect(handler).not.toMatch(/\.insert\(\{/);
    expect(handler).not.toMatch(/ocade_automations"\)\s*\.update/);
  });
});

describe("the three definitions stay in lockstep", () => {
  /**
   * The status set is written in three places: the engine constant, the server
   * guard, and the SQL index predicate. If they drift, duplicates return.
   */
  it("the engine list matches what the fake index enforces", () => {
    for (const s of IN_FLIGHT_STATUSES) expect(isInFlight(s)).toBe(true);
    for (const s of ["succeeded", "failed", "cancelled", "blocked"] as RunStatus[]) {
      expect(isInFlight(s)).toBe(false);
    }
  });

  it("the SQL predicate in the migration lists exactly these statuses", async () => {
    const fs = await import("node:fs");
    const sql = fs.readFileSync("supabase/migrations/20260722110000_ocade_automations.sql", "utf8");
    // Scope to the INDEX statement — the status column also has a CHECK
    // constraint listing every status, which is not what we are asserting.
    const idx = /CREATE UNIQUE INDEX[\s\S]*?ocade_automation_runs_one_in_flight_idx[\s\S]*?;/.exec(
      sql,
    );
    expect(idx).toBeTruthy();
    const match = /status IN \(([^)]*)\)/.exec(idx?.[0] ?? "");
    expect(match).toBeTruthy();
    const inSql = (match?.[1] ?? "")
      .split(",")
      .map((s) => s.trim().replace(/'/g, ""))
      .sort();
    expect(inSql).toEqual([...IN_FLIGHT_STATUSES].sort());
  });

  it("the migration excludes dry runs from the index", async () => {
    const fs = await import("node:fs");
    const sql = fs.readFileSync("supabase/migrations/20260722110000_ocade_automations.sql", "utf8");
    expect(sql).toMatch(/WHERE dry_run = false/);
  });
});
