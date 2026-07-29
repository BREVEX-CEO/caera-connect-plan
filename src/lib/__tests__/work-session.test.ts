import { describe, it, expect, beforeEach, vi } from "vitest";
import { planStep, completeStep, describeIntent, planMismatch } from "../skills/work-session";
import { createTaskScope } from "../skills/task-scope";
import { saveAppMap, fingerprintApp, listAppMaps } from "../skills/app-map";
import { initialHealth, recordOutcome } from "../skills/adapter-health";
import type { AdapterHealth } from "../skills/adapter-health";
import type { AppIdentity, ControlMethod, SkillCapability, SkillPack } from "../skills/skill-pack";

const NOW = new Date("2026-07-23T10:00:00Z");

const capability: SkillCapability = {
  id: "window.list",
  label: "List open windows",
  methods: ["official_api", "accessibility", "vision_input"],
  mutating: false,
  verifyBy: "api",
  tested: true,
};

const app: AppIdentity = { appId: "demo.app", displayName: "Demo", version: "1.0.0" };

const pack: SkillPack = {
  appId: "demo.app",
  displayName: "Demo",
  category: "os_utilities",
  testedVersions: ["1."],
  capabilities: [capability],
  requiresLicensedInstall: false,
};

const scope = () =>
  createTaskScope({
    id: "t1",
    summary: "Look at what's open",
    capabilities: ["window.list"],
    now: NOW,
  });

function base(over: Partial<Parameters<typeof planStep>[0]> = {}) {
  return {
    action: { kind: "window.list" } as const,
    capability,
    app,
    packs: [pack],
    scope: scope(),
    health: new Map<ControlMethod, AdapterHealth>(),
    availableMethods: ["official_api", "accessibility"] as ControlMethod[],
    recording: "video_off" as const,
    now: NOW,
    ...over,
  };
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

/**
 * The order of checks matters: each must run while it can still PREVENT harm,
 * not merely report it afterwards.
 */
describe("planning one step", () => {
  it("refuses a capability that is not in the matched pack", () => {
    const r = planStep(
      base({
        capability: {
          ...capability,
          id: "window.close_everything",
          label: "Close every window",
          mutating: true,
        },
      }),
    );
    expect(r.status).toBe("refused");
    if (r.status !== "refused") throw new Error("unreachable");
    expect(r.reason).toMatch(/not declare/i);
  });

  it("refuses caller-altered safety metadata for a known capability", () => {
    const r = planStep(
      base({
        capability: {
          ...capability,
          mutating: true,
          verifyBy: "none",
          methods: ["vision_input"],
        },
      }),
    );
    expect(r.status).toBe("refused");
    if (r.status !== "refused") throw new Error("unreachable");
    expect(r.reason).toMatch(/does not match the registered skill pack/i);
  });

  it("produces a plan when everything checks out", () => {
    const r = planStep(base());
    expect(r.status).toBe("ready");
    if (r.status !== "ready") throw new Error("unreachable");
    expect(r.plan.method).toBe("official_api");
    expect(r.plan.confidence).toBeGreaterThan(0.7);
  });

  it("counts the step against the scope so the receipt is accurate", () => {
    const r = planStep(base());
    if (r.status !== "ready") throw new Error("unreachable");
    expect(r.plan.scope.steps).toBe(1);
  });

  /** Scope is checked FIRST — an unapproved step is not analysed further. */
  it("refuses an unapproved step before doing any other work", () => {
    const r = planStep(base({ scope: null }));
    expect(r.status).toBe("refused");
    if (r.status !== "refused") throw new Error("unreachable");
    expect(r.escalate).toBe(true);
  });

  it("refuses protected input outright, with no escalation path", () => {
    const r = planStep(
      base({
        action: { kind: "text.type", text: "my password is hunter2" },
        scope: createTaskScope({ id: "t", summary: "x", capabilities: ["text.type"], now: NOW }),
      }),
    );
    expect(r.status).toBe("refused");
    if (r.status !== "refused") throw new Error("unreachable");
    expect(r.escalate).toBe(false);
  });

  it("states app, version, risk and confidence before acting", () => {
    const line = describeIntent(app, capability, "official_api", 0.9);
    expect(line).toContain("Demo");
    expect(line).toContain("1.0.0");
    expect(line).toMatch(/reads only/);
    expect(line).toMatch(/90% confident/);
  });

  it("says a mutating step changes something", () => {
    const line = describeIntent(app, { ...capability, mutating: true }, "official_api", 0.9);
    expect(line).toMatch(/changes something/);
  });
});

describe("inspecting before acting on an unfamiliar app", () => {
  it("asks to inspect when the version is untested and no map exists", () => {
    const r = planStep(base({ app: { ...app, version: "9.9.9" } }));
    expect(r.status).toBe("needs_inspection");
    if (r.status !== "needs_inspection") throw new Error("unreachable");
    expect(r.previousMap).toBeNull();
  });

  it("re-inspects when the saved map is stale, keeping the old one as context", () => {
    saveAppMap(
      {
        appId: "demo.app",
        displayName: "Demo",
        version: "9.9.8",
        fingerprint: "old-layout",
        controls: [{ id: "c", label: "C", method: "accessibility", anchor: "aria:C" }],
      },
      NOW,
    );
    const r = planStep(base({ app: { ...app, version: "9.9.9" } }));
    expect(r.status).toBe("needs_inspection");
    if (r.status !== "needs_inspection") throw new Error("unreachable");
    expect(r.previousMap?.controls).toHaveLength(1);
  });

  it("proceeds without inspection when a FRESH map exists for an untested version", () => {
    const fp = fingerprintApp({ version: "9.9.9" });
    saveAppMap(
      {
        appId: "demo.app",
        displayName: "Demo",
        version: "9.9.9",
        fingerprint: fp,
        controls: [
          {
            id: "window.list",
            label: "List open windows",
            method: "official_api",
            anchor: "api:window.list",
          },
        ],
      },
      NOW,
    );
    const r = planStep(base({ app: { ...app, version: "9.9.9" } }));
    expect(r.status).toBe("ready");
  });

  it("a tested version never needs inspection", () => {
    expect(planStep(base()).status).toBe("ready");
  });
});

describe("routing around failures and limits", () => {
  it("uses a healthy slower route when the best one is failing", () => {
    let bad = initialHealth("official_api");
    bad = recordOutcome(bad, { ok: false });
    bad = recordOutcome(bad, { ok: false });

    const r = planStep(base({ health: new Map([["official_api", bad]]) }));
    if (r.status !== "ready") throw new Error("unreachable");
    expect(r.plan.method).toBe("accessibility");
    expect(r.plan.routedAround).toEqual(["official_api"]);
  });

  it("STOPS rather than retrying blindly when every route is failing", () => {
    const fail = (m: ControlMethod) =>
      recordOutcome(recordOutcome(initialHealth(m), { ok: false }), { ok: false });
    const r = planStep(
      base({
        health: new Map([
          ["official_api", fail("official_api")],
          ["accessibility", fail("accessibility")],
        ]),
      }),
    );
    expect(r.status).toBe("refused");
    if (r.status !== "refused") throw new Error("unreachable");
    expect(r.reason).toMatch(/stopped rather than retry blindly/i);
  });

  it("reports over-budget work up front instead of stopping halfway", () => {
    const r = planStep(base({ remainingSteps: 10_000, averageStepMs: 5_000 }));
    expect(r.status).toBe("over_budget");
    if (r.status !== "over_budget") throw new Error("unreachable");
    expect(r.reason).toMatch(/smaller batches/i);
  });

  it("applies the recording style for the current mode", () => {
    const on = planStep(base({ recording: "video_on" }));
    if (on.status !== "ready") throw new Error("unreachable");
    expect(on.plan.style.visiblePointer).toBe(true);
    expect(on.plan.style.allowShortcuts).toBe(false);
  });
});

/**
 * A receipt is proof. Producing a verified one without a real check would be
 * the fabricated success this product refuses to emit.
 */
describe("receipts after the fact", () => {
  const plan = () => {
    const r = planStep(base());
    if (r.status !== "ready") throw new Error("unreachable");
    return r.plan;
  };

  it("records a verified step with its evidence", () => {
    const receipt = completeStep({
      plan: plan(),
      verified: true,
      evidence: "3 windows returned",
      now: NOW,
    });
    expect(receipt.verified).toBe(true);
    expect(receipt.evidence).toContain("3 windows");
  });

  it("marks an unverified step instead of presenting it as done", () => {
    const receipt = completeStep({
      plan: plan(),
      verified: false,
      evidence: "no response",
      now: NOW,
    });
    expect(receipt.verified).toBe(false);
    expect(receipt.evidence).toMatch(/^NOT CONFIRMED:/);
  });

  /** A capability with no way to be checked can never yield a verified receipt. */
  it("REFUSES to mark a step verified when the capability cannot be checked", () => {
    const r = planStep(base());
    if (r.status !== "ready") throw new Error("unreachable");
    const receipt = completeStep({
      plan: { ...r.plan, capability: { ...r.plan.capability, verifyBy: "none" } },
      verified: true,
      evidence: "looked fine",
      now: NOW,
    });
    expect(receipt.verified).toBe(false);
    expect(receipt.evidence).toMatch(/no way to be checked/i);
  });

  it("credits the app map only for a genuinely verified step", () => {
    const fp = fingerprintApp({ version: "1.0.0" });
    saveAppMap(
      {
        appId: "demo.app",
        displayName: "Demo",
        version: "1.0.0",
        fingerprint: fp,
        controls: [
          {
            id: "window.list",
            label: "List open windows",
            method: "official_api",
            anchor: "api:window.list",
          },
        ],
      },
      NOW,
    );
    completeStep({ plan: plan(), verified: false, evidence: "x", now: NOW });
    expect(listAppMaps()[0].uses).toBe(0);

    completeStep({ plan: plan(), verified: true, evidence: "ok", now: NOW });
    expect(listAppMaps()[0].uses).toBe(1);
  });
});

/** Continuing after a mismatch is how one wrong step becomes ten. */
describe("when the result doesn't match what was expected", () => {
  it("stops, undoes a change, re-detects and allows one retry", () => {
    const p = planMismatch({ ...capability, mutating: true }, 0);
    expect(p.stop).toBe(true);
    expect(p.undo).toBe(true);
    expect(p.reDetect).toBe(true);
    expect(p.retry).toBe(true);
  });

  it("does not retry a second time — repeating a change risks doing it twice", () => {
    const p = planMismatch({ ...capability, mutating: true }, 1);
    expect(p.retry).toBe(false);
    expect(p.reason).toMatch(/second attempt didn't help/i);
  });

  it("has nothing to undo for a read-only step", () => {
    expect(planMismatch(capability, 0).undo).toBe(false);
  });
});
