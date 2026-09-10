import { describe, it, expect } from "vitest";
import { resolveEngine, cloudWouldWorkAfterApproval, type EngineContext } from "../engine/resolve";

/**
 * THE ONE ROUTING DECISION, NOW THAT THERE IS ONLY ONE PLACE TO ROUTE TO.
 *
 * This file used to pin a local-versus-cloud policy: privacy before engine
 * selection, local before cloud, four separate cloud refusals with four
 * separate remedies. That policy was carefully built and had one hole — the
 * privacy gate exempted `private_sync`, which is the DEFAULT privacy mode, so
 * the check that made the product feel safe did not run for almost any real
 * conversation.
 *
 * The hole is closed by removing the destination rather than by adding a
 * fifth condition. What these tests pin now is the stronger property: there is
 * no combination of inputs that produces a remote engine, and when the local
 * engine cannot serve, the refusal says which obstacle it is and what clears
 * it — because a refusal is the only thing a user sees when this goes wrong.
 */

const base: EngineContext = {
  preference: "auto",
  deviceMode: "pc_web",
  localAvailable: true,
  localLabel: "OCADE Local Fast",
  localVision: false,
  visionRequired: false,
  online: true,
};

const ctx = (over: Partial<EngineContext> = {}): EngineContext => ({ ...base, ...over });

describe("local serves whenever it can", () => {
  it("uses the on-device engine", () => {
    const d = resolveEngine(ctx());
    expect(d.ok).toBe(true);
    expect(d.target).toEqual({ kind: "local", label: "OCADE Local Fast" });
  });

  it("never charges allowance for work done on the user's own hardware", () => {
    expect(resolveEngine(ctx()).consumesAllowance).toBe(false);
  });

  it("needs no approval, because nothing leaves the device", () => {
    const d = resolveEngine(ctx());
    expect(d.ok).toBe(true);
    expect(d.needsCloudApproval).toBe(false);
  });

  it("uses local while offline", () => {
    const d = resolveEngine(ctx({ online: false }));
    expect(d.ok).toBe(true);
    expect(d.target?.kind).toBe("local");
  });

  it("falls back to a generic label rather than an empty one", () => {
    const d = resolveEngine(ctx({ localLabel: null }));
    expect(d.target).toEqual({ kind: "local", label: "OCADE Local" });
  });
});

describe("there is no route off the device", () => {
  it("never returns a remote target, under any combination of inputs", () => {
    for (const preference of ["auto", "local_only"] as const) {
      for (const localAvailable of [true, false]) {
        for (const localVision of [true, false]) {
          for (const visionRequired of [true, false]) {
            for (const online of [true, false]) {
              const d = resolveEngine(
                ctx({
                  preference,
                  localAvailable,
                  localVision,
                  visionRequired,
                  online,
                }),
              );
              if (d.target) expect(d.target.kind).toBe("local");
              expect(d.needsCloudApproval).toBe(false);
              expect(d.consumesAllowance).toBe(false);
            }
          }
        }
      }
    }
  });

  it("answers no when asked whether approval would unlock anything", () => {
    expect(cloudWouldWorkAfterApproval(ctx({ localAvailable: false }))).toBe(false);
  });
});

describe("local-only refuses rather than substituting", () => {
  it("refuses with the remedies for this device mode", () => {
    const d = resolveEngine(ctx({ preference: "local_only", localAvailable: false }));
    expect(d.ok).toBe(false);
    expect(d.code).toBe("local_only_and_no_local_engine");
    expect(d.remedies.length).toBeGreaterThan(0);
  });

  it("tells a phone to pair a computer, not to install a desktop app", () => {
    const d = resolveEngine(
      ctx({ preference: "local_only", localAvailable: false, deviceMode: "mobile_web" }),
    );
    expect(d.ok).toBe(false);
    expect(d.remedies).not.toContain("install_desktop");
  });

  it("names vision as the obstacle when that is what is missing", () => {
    const d = resolveEngine(
      ctx({ preference: "local_only", visionRequired: true, localVision: false }),
    );
    expect(d.ok).toBe(false);
    expect(d.code).toBe("vision_unavailable_locally");
    expect(d.reason).toMatch(/image/i);
  });
});

describe("the refusal names the real obstacle", () => {
  it("says the engine is PREPARING, not broken, on a first visit", () => {
    const d = resolveEngine(ctx({ localAvailable: false, online: true }));
    expect(d.ok).toBe(false);
    expect(d.code).toBe("local_engine_preparing");
    // The commonest case on day one is not an error, and must not read as one.
    expect(d.reason).toMatch(/no setup needed/i);
    expect(d.reason).not.toMatch(/error|failed/i);
  });

  it("separates offline-with-no-engine from preparing", () => {
    const d = resolveEngine(ctx({ localAvailable: false, online: false }));
    expect(d.code).toBe("offline_and_no_local_engine");
    expect(d.reason).toMatch(/offline/i);
    // Tells them the one thing that fixes it permanently.
    expect(d.reason).toMatch(/reconnect/i);
  });

  it("explains a vision gap without offering to send the picture away", () => {
    const d = resolveEngine(ctx({ visionRequired: true, localVision: false }));
    expect(d.code).toBe("vision_unavailable_locally");
    expect(d.reason).toMatch(/describe what is in the picture/i);
  });

  it("offers a remedy on every refusal", () => {
    const cases: EngineContext[] = [
      ctx({ localAvailable: false, online: true }),
      ctx({ localAvailable: false, online: false }),
      ctx({ preference: "local_only", localAvailable: false }),
    ];
    for (const c of cases) {
      const d = resolveEngine(c);
      expect(d.ok).toBe(false);
      expect(d.remedies.length).toBeGreaterThan(0);
    }
  });
});

describe("the decision is always complete", () => {
  it("returns a reason and a code on every failure, and neither on success", () => {
    const bad = resolveEngine(ctx({ localAvailable: false }));
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBeTruthy();
    expect(bad.code).toBeTruthy();
    expect(bad.target).toBeNull();

    const good = resolveEngine(ctx());
    expect(good.ok).toBe(true);
    expect(good.reason).toBeNull();
    expect(good.code).toBeNull();
    expect(good.target).not.toBeNull();
  });

  it("never marks a refusal as consuming allowance", () => {
    expect(resolveEngine(ctx({ localAvailable: false })).consumesAllowance).toBe(false);
  });
});
