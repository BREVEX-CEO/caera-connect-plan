import { describe, it, expect, vi } from "vitest";
import {
  runPcTransaction,
  checkCoordinate,
  isDestructive,
  requiresCage,
  CAGED_ROUTES,
  type BackupProvider,
  type CoordinateCage,
  type PcTransactionInput,
} from "../control/pc-transaction";
import type { ControlOutcome, OcadeActionRequest } from "../control/control-plane";

const PERM = "control.ui";
const FUTURE = new Date(Date.now() + 60_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

const req = (over: Partial<OcadeActionRequest> = {}): OcadeActionRequest => ({
  actionId: "a1",
  taskId: "t1",
  stepId: "s1",
  appIdentity: { appId: "com.example.editor", version: "1.0.0", windowId: "w1" },
  capability: "click",
  route: "accessibility",
  arguments: {},
  risk: "low",
  requiredPermission: PERM,
  expectedPostconditions: [],
  verificationPlan: [],
  timeoutMs: 5000,
  retryBudget: 0,
  idempotencyKey: "k1",
  ...over,
});

const verified = (r: OcadeActionRequest): ControlOutcome =>
  ({
    status: "verified",
    request: r,
    receipt: {
      verified: true,
      evidence: [],
      observations: [],
      missingPostconditions: [],
      mismatchedPostconditions: [],
    },
  }) as ControlOutcome;
const failed = (r: OcadeActionRequest, reason = "boom"): ControlOutcome =>
  ({ status: "failed", request: r, reason }) as ControlOutcome;

const base = (over: Partial<PcTransactionInput> = {}): PcTransactionInput => ({
  request: req(),
  grants: new Set([PERM]),
  grantExpiresAt: FUTURE,
  isHalted: () => false,
  execute: async (r) => verified(r),
  ...over,
});

const CAGE: CoordinateCage = { bounds: { x: 0, y: 0, width: 100, height: 100 }, scale: 1 };

describe("coordinate safety cage", () => {
  it("refuses a coordinate with no approved region at all", () => {
    const v = checkCoordinate({ x: 5, y: 5 }, null, 1);
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.refusal).toBe("no_cage");
  });

  it("REFUSES rather than clamps a point outside the region", () => {
    // Clamping would move the click to the window edge — a different button.
    const v = checkCoordinate({ x: 500, y: 5 }, CAGE, 1);
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.refusal).toBe("outside_cage");
  });

  it("refuses when the point and the region are at different scales", () => {
    const v = checkCoordinate({ x: 5, y: 5 }, { ...CAGE, scale: 2 }, 1);
    expect(v.allowed).toBe(false);
    if (!v.allowed) {
      expect(v.refusal).toBe("unknown_scale");
      expect(v.reason).toMatch(/1x.*2x|2x.*1x/);
    }
  });

  it("refuses a point inside a protected exclusion", () => {
    const caged: CoordinateCage = {
      ...CAGE,
      exclusions: [{ x: 10, y: 10, width: 20, height: 20 }],
    };
    expect(checkCoordinate({ x: 15, y: 15 }, caged, 1).allowed).toBe(false);
    expect(checkCoordinate({ x: 50, y: 50 }, caged, 1).allowed).toBe(true);
  });

  it("refuses a zero-area region", () => {
    const v = checkCoordinate(
      { x: 0, y: 0 },
      { bounds: { x: 0, y: 0, width: 0, height: 0 }, scale: 1 },
      1,
    );
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.refusal).toBe("zero_area");
  });

  it("only cages the routes that act on coordinates", () => {
    expect([...CAGED_ROUTES]).toEqual(["vision", "input"]);
    expect(requiresCage("input")).toBe(true);
    expect(requiresCage("api")).toBe(false);
    expect(requiresCage("accessibility")).toBe(false);
  });
});

describe("destructive classification", () => {
  it("derives destructiveness from the capability, not a caller flag", () => {
    for (const c of ["delete", "uninstall", "kill_process", "empty_trash", "disable_startup"]) {
      expect(isDestructive(c)).toBe(true);
    }
    for (const c of ["click", "read", "focus", "type"]) expect(isDestructive(c)).toBe(false);
  });

  it("refuses a destructive action without explicit confirmation", async () => {
    const r = await runPcTransaction(base({ request: req({ capability: "delete" }) }));
    expect(r.outcome).toBe("refused");
    expect(r.reason).toMatch(/destructive_unconfirmed/);
    expect(r.destructive).toBe(true);
  });

  it("proceeds once confirmed", async () => {
    const r = await runPcTransaction(
      base({ request: req({ capability: "delete" }), confirmed: true }),
    );
    expect(r.outcome).toBe("verified");
  });
});

describe("stage ordering is a safety property", () => {
  it("emergency stop refuses BEFORE permission is even considered", async () => {
    const execute = vi.fn();
    const r = await runPcTransaction(
      base({ isHalted: () => true, grants: new Set(), execute: execute as never }),
    );
    expect(r.reason).toMatch(/halted/);
    expect(execute).not.toHaveBeenCalled();
    expect(r.stages[0].stage).toBe("emergency_stop");
  });

  it("refuses an expired permission grant", async () => {
    const r = await runPcTransaction(base({ grantExpiresAt: PAST }));
    expect(r.reason).toMatch(/permission_expired/);
  });

  it("refuses a missing permission", async () => {
    const r = await runPcTransaction(base({ grants: new Set() }));
    expect(r.reason).toMatch(/not_permitted/);
  });

  it("refuses when cancelled before dispatch", async () => {
    const ac = new AbortController();
    ac.abort();
    const execute = vi.fn();
    const r = await runPcTransaction(base({ signal: ac.signal, execute: execute as never }));
    expect(r.reason).toMatch(/cancelled/);
    expect(execute).not.toHaveBeenCalled();
  });

  it("records every stage that ran, in order", async () => {
    const r = await runPcTransaction(base());
    expect(r.stages.map((s) => s.stage)).toEqual([
      "emergency_stop",
      "cancellation",
      "permission",
      "permission_expiry",
      "destructive_confirmation",
      "coordinate_cage",
      "preview",
      "backup",
      "execute",
      "verify",
    ]);
  });
});

describe("preview / dry run", () => {
  it("a rejected preview stops the transaction before any mutation", async () => {
    const execute = vi.fn();
    const r = await runPcTransaction(
      base({
        preview: async () => ({ ok: false, detail: "would overwrite 12 files" }),
        execute: execute as never,
      }),
    );
    expect(r.outcome).toBe("refused");
    expect(r.reason).toMatch(/preview_rejected.*overwrite 12 files/);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("backup before mutation", () => {
  const provider = (over: Partial<BackupProvider> = {}): BackupProvider => ({
    create: async () => ({ token: "tok" }),
    verify: async () => true,
    restore: async () => true,
    ...over,
  });

  it("takes a verified backup for a high-risk action", async () => {
    const r = await runPcTransaction(
      base({
        request: req({ risk: "high", arguments: { path: "/etc/thing" } }),
        backup: provider(),
      }),
    );
    expect(r.backup?.verified).toBe(true);
    expect(r.backup?.target).toBe("/etc/thing");
  });

  it("REFUSES when the backup cannot be read back", async () => {
    // A backup nobody proved readable is a promise, not a safety net.
    const execute = vi.fn();
    const r = await runPcTransaction(
      base({
        request: req({ risk: "high" }),
        backup: provider({ verify: async () => false }),
        execute: execute as never,
      }),
    );
    expect(r.outcome).toBe("refused");
    expect(r.reason).toMatch(/backup_failed.*read back/);
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses when the backup cannot be created", async () => {
    const r = await runPcTransaction(
      base({ request: req({ risk: "high" }), backup: provider({ create: async () => null }) }),
    );
    expect(r.reason).toMatch(/backup_failed/);
  });

  it("does not demand a backup for a low-risk read", async () => {
    const create = vi.fn(async () => ({ token: "t" }));
    const r = await runPcTransaction(base({ backup: provider({ create }) }));
    expect(r.outcome).toBe("verified");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("duplicate protection", () => {
  it("reports a replayed action without re-executing or rolling back", async () => {
    const r = await runPcTransaction(
      base({
        execute: async (rq) =>
          ({
            status: "replayed",
            request: rq,
            receipt: {
              verified: true,
              evidence: [],
              observations: [],
              missingPostconditions: [],
              mismatchedPostconditions: [],
            },
          }) as ControlOutcome,
      }),
    );
    expect(r.outcome).toBe("replayed");
    expect(r.rollback).toBeNull();
  });
});

describe("rollback", () => {
  const withPlan = (ready = true) =>
    req({
      risk: "high",
      rollbackPlan: [
        { id: "r1", kind: "undo", description: "undo the edit", ready },
        { id: "r2", kind: "restore", description: "restore the file", ready },
      ],
    });

  it("executes the rollback plan in REVERSE order on failure", async () => {
    const order: string[] = [];
    const r = await runPcTransaction(
      base({
        request: withPlan(),
        execute: async (rq) => failed(rq),
        recover: async (s) => {
          order.push(s.id);
          return true;
        },
      }),
    );
    // Reverse: replaying forward would re-apply the sequence that failed.
    expect(order).toEqual(["r2", "r1"]);
    expect(r.outcome).toBe("rolled_back");
    expect(r.rollback?.ok).toBe(true);
  });

  it("SKIPS recovery steps that declare themselves not ready", async () => {
    const recover = vi.fn(async () => true);
    const r = await runPcTransaction(
      base({ request: withPlan(false), execute: async (rq) => failed(rq), recover }),
    );
    expect(recover).not.toHaveBeenCalled();
    expect(r.rollback?.attempted).toBe(false);
    expect(r.rollback?.detail).toMatch(/not ready/);
    expect(r.outcome).toBe("failed");
  });

  it("reports which steps completed when one fails mid-rollback", async () => {
    const r = await runPcTransaction(
      base({
        request: withPlan(),
        execute: async (rq) => failed(rq),
        recover: async (s) => s.id === "r2",
      }),
    );
    expect(r.rollback?.ok).toBe(false);
    expect(r.rollback?.detail).toMatch(/"r1".*failed/);
    expect(r.rollback?.detail).toMatch(/r2/);
  });

  it("restores the backup after the recovery steps", async () => {
    const restore = vi.fn(async () => true);
    const r = await runPcTransaction(
      base({
        request: withPlan(),
        backup: { create: async () => ({ token: "tok" }), verify: async () => true, restore },
        execute: async (rq) => failed(rq),
        recover: async () => true,
      }),
    );
    expect(restore).toHaveBeenCalledWith("tok");
    expect(r.outcome).toBe("rolled_back");
  });

  it("does not claim rollback when there is no plan and no backup", async () => {
    const r = await runPcTransaction(base({ execute: async (rq) => failed(rq) }));
    expect(r.outcome).toBe("failed");
    expect(r.rollback?.attempted).toBe(false);
    expect(r.rollback?.detail).toMatch(/could not be undone automatically/);
  });

  it("reports failure when a restore silently does not happen", async () => {
    const r = await runPcTransaction(
      base({
        request: withPlan(),
        backup: {
          create: async () => ({ token: "t" }),
          verify: async () => true,
          restore: async () => false,
        },
        execute: async (rq) => failed(rq),
        recover: async () => true,
      }),
    );
    expect(r.rollback?.ok).toBe(false);
    expect(r.outcome).toBe("failed");
  });
});

describe("coordinate routes inside a transaction", () => {
  it("refuses a coordinate route with no point supplied", async () => {
    const r = await runPcTransaction(base({ request: req({ route: "input" }), cage: CAGE }));
    expect(r.reason).toMatch(/cage_refused.*no coordinate/);
  });

  it("refuses a caged route whose point is outside the window", async () => {
    const execute = vi.fn();
    const r = await runPcTransaction(
      base({
        request: req({ route: "input" }),
        cage: CAGE,
        point: { x: 999, y: 999, scale: 1 },
        execute: execute as never,
      }),
    );
    expect(r.reason).toMatch(/cage_refused/);
    expect(execute).not.toHaveBeenCalled();
  });

  it("allows a caged route whose point is inside", async () => {
    const r = await runPcTransaction(
      base({ request: req({ route: "input" }), cage: CAGE, point: { x: 50, y: 50, scale: 1 } }),
    );
    expect(r.outcome).toBe("verified");
  });
});

describe("planted regression", () => {
  it("a transaction that stopped checking the cage would let a wild click through", async () => {
    // Honest path: refused.
    const guarded = await runPcTransaction(
      base({ request: req({ route: "input" }), cage: CAGE, point: { x: 5000, y: 5000, scale: 1 } }),
    );
    expect(guarded.outcome).toBe("refused");

    // The same point on a region that legitimately contains it is allowed —
    // proving the refusal is driven by the cage, not hard-coded either way.
    const wide: CoordinateCage = { bounds: { x: 0, y: 0, width: 10000, height: 10000 }, scale: 1 };
    const allowed = await runPcTransaction(
      base({ request: req({ route: "input" }), cage: wide, point: { x: 5000, y: 5000, scale: 1 } }),
    );
    expect(allowed.outcome).toBe("verified");
  });

  it("every receipt names its outcome and carries its stages", async () => {
    const r = await runPcTransaction(base({ request: req({ capability: "delete" }) }));
    expect(r.outcome).toBe("refused");
    expect(r.reason).toBeTruthy();
    expect(r.stages.length).toBeGreaterThan(0);
    expect(r.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r.idempotencyKey).toBe("k1");
  });
});
