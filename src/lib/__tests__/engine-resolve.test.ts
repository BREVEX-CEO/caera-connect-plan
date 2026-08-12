import { describe, it, expect } from "vitest";
import { resolveEngine, cloudWouldWorkAfterApproval, type EngineContext } from "../engine/resolve";

/**
 * THE ONE ROUTING DECISION.
 *
 * Six modules could each answer part of "where does this request run?" and none
 * answered all of it, so the rules that span levels lived nowhere: privacy mode
 * never reached the adapter choice, and the allowance never reached the refusal
 * text. These tests pin the combined policy, and especially its ORDER — privacy
 * before engine selection, local before cloud, and a named refusal rather than
 * a silent substitution.
 */

const base: EngineContext = {
  preference: "auto",
  privacyMode: "private_sync",
  deviceMode: "pc_web",
  localAvailable: true,
  localLabel: "OCADE Local Fast",
  localVision: false,
  visionRequired: false,
  cloudConfigured: true,
  cloudEntitled: true,
  cloudRemaining: 28,
  cloudResetsAt: null,
  cloudApprovedForConversation: false,
  online: true,
};

const ctx = (over: Partial<EngineContext> = {}): EngineContext => ({ ...base, ...over });

describe("local wins whenever it can serve", () => {
  it("uses the on-device engine even with cloud fully available", () => {
    const decision = resolveEngine(ctx());
    expect(decision.ok).toBe(true);
    expect(decision.target).toEqual({ kind: "local", label: "OCADE Local Fast" });
  });

  it("never charges allowance for work done on the user's own hardware", () => {
    // The rule the whole product rests on.
    expect(resolveEngine(ctx()).consumesAllowance).toBe(false);
  });

  it("uses local even for a vault-backed conversation, with no approval needed", () => {
    /*
     * The point of local: a browser-vault conversation is answered without
     * asking anyone's permission, because nothing leaves the device.
     */
    const decision = resolveEngine(ctx({ privacyMode: "browser_only" }));
    expect(decision.ok).toBe(true);
    expect(decision.target?.kind).toBe("local");
    expect(decision.needsCloudApproval).toBe(false);
  });

  it("uses local while offline", () => {
    const decision = resolveEngine(ctx({ online: false }));
    expect(decision.ok).toBe(true);
    expect(decision.target?.kind).toBe("local");
  });

  it("goes to cloud only when the user explicitly asked for cloud", () => {
    const decision = resolveEngine(ctx({ preference: "cloud_only" }));
    expect(decision.target?.kind).toBe("cloud");
    expect(decision.consumesAllowance).toBe(true);
  });
});

describe("privacy is checked before an engine is chosen", () => {
  it("asks for approval rather than refusing, when approval is the only obstacle", () => {
    /*
     * This must be distinguishable from every other failure: the user can fix
     * it in one click, so the screen shows a prompt, not a dead end.
     */
    const decision = resolveEngine(ctx({ localAvailable: false, privacyMode: "pc_vault" }));
    expect(decision.ok).toBe(false);
    expect(decision.needsCloudApproval).toBe(true);
    expect(decision.code).toBe("privacy_requires_approval");
    expect(decision.reason).toMatch(/stored on your device/);
  });

  it("proceeds once the conversation has been approved", () => {
    const decision = resolveEngine(
      ctx({ localAvailable: false, privacyMode: "pc_vault", cloudApprovedForConversation: true }),
    );
    expect(decision.ok).toBe(true);
    expect(decision.target?.kind).toBe("cloud");
  });

  it("needs no approval for a conversation already synced to the cloud", () => {
    const decision = resolveEngine(ctx({ localAvailable: false, privacyMode: "private_sync" }));
    expect(decision.ok).toBe(true);
    expect(decision.needsCloudApproval).toBe(false);
  });

  it("does not ask for approval it would refuse anyway", () => {
    /*
     * Prompting for permission and then refusing for a different reason is the
     * worst possible sequence. A caller checks this before asking.
     */
    const spent = ctx({ localAvailable: false, privacyMode: "pc_vault", cloudRemaining: 0 });
    expect(cloudWouldWorkAfterApproval(spent)).toBe(false);

    const fine = ctx({ localAvailable: false, privacyMode: "pc_vault" });
    expect(cloudWouldWorkAfterApproval(fine)).toBe(true);
  });
});

describe("local-only refuses rather than substituting", () => {
  it("refuses with the remedies for this device mode", () => {
    const decision = resolveEngine(
      ctx({ preference: "local_only", localAvailable: false, deviceMode: "pc_web" }),
    );
    expect(decision.ok).toBe(false);
    expect(decision.code).toBe("local_only_and_no_local_engine");
    expect(decision.reason).toMatch(/never to use the cloud/);
    expect(decision.remedies).toContain("install_ocade");
  });

  it("tells a phone to pair a computer, not to install a desktop app", () => {
    // A generic refusal is true everywhere and useful nowhere.
    const decision = resolveEngine(
      ctx({ preference: "local_only", localAvailable: false, deviceMode: "mobile_web" }),
    );
    expect(decision.remedies).toContain("pair_a_computer");
    expect(decision.remedies).not.toContain("install_ocade");
  });

  it("names vision as the obstacle when that is what is missing", () => {
    const decision = resolveEngine(
      ctx({
        preference: "local_only",
        localAvailable: true,
        localVision: false,
        visionRequired: true,
      }),
    );
    expect(decision.code).toBe("vision_unavailable_locally");
    expect(decision.reason).toMatch(/cannot read images/);
  });

  it("never reaches cloud under local_only, whatever else is true", () => {
    for (const over of [
      { cloudEntitled: true, cloudRemaining: 99 },
      { privacyMode: "private_sync" as const },
      { cloudApprovedForConversation: true },
    ]) {
      const decision = resolveEngine(
        ctx({ preference: "local_only", localAvailable: false, ...over }),
      );
      expect(decision.target?.kind).not.toBe("cloud");
    }
  });
});

describe("each cloud obstacle has its own refusal", () => {
  const noLocal = { localAvailable: false };

  it("separates offline from unconfigured from unentitled from spent", () => {
    // Four different fixes; "cloud unavailable" would help with none of them.
    expect(resolveEngine(ctx({ ...noLocal, online: false })).code).toBe(
      "offline_and_no_local_engine",
    );
    expect(resolveEngine(ctx({ ...noLocal, cloudConfigured: false })).code).toBe(
      "cloud_not_configured",
    );
    expect(resolveEngine(ctx({ ...noLocal, cloudEntitled: false })).code).toBe(
      "cloud_not_entitled",
    );
    expect(resolveEngine(ctx({ ...noLocal, cloudRemaining: 0 })).code).toBe(
      "cloud_allowance_spent",
    );
  });

  it("says local stays unlimited when the plan excludes cloud", () => {
    const decision = resolveEngine(ctx({ ...noLocal, cloudEntitled: false }));
    expect(decision.reason).toMatch(/On-device processing stays unlimited/);
  });

  it("names the reset time when the allowance is spent", () => {
    const resetsAt = new Date("2026-01-01T12:00:00Z");
    const decision = resolveEngine(ctx({ ...noLocal, cloudRemaining: 0, cloudResetsAt: resetsAt }));
    expect(decision.reason).toMatch(/resets at/);
    expect(decision.reason).toMatch(/unlimited/);
  });

  it("tells an offline user to download an engine while they still can", () => {
    const decision = resolveEngine(ctx({ ...noLocal, online: false }));
    expect(decision.reason).toMatch(/while you have a connection/);
  });

  it("offers a remedy on every refusal", () => {
    // A refusal with no next step is a dead end wearing an error message.
    for (const over of [
      { online: false },
      { cloudConfigured: false },
      { cloudEntitled: false },
      { cloudRemaining: 0 },
    ]) {
      const decision = resolveEngine(ctx({ ...noLocal, ...over }));
      expect(decision.ok).toBe(false);
      expect(decision.remedies.length, JSON.stringify(over)).toBeGreaterThan(0);
    }
  });
});

describe("vision falls through to cloud rather than answering blind", () => {
  it("uses cloud when the local engine cannot read the image", () => {
    /*
     * The alternative — routing to a local engine that cannot see and letting
     * it answer anyway — produces a confident reply about an image it never
     * read, which is worse than any refusal.
     */
    const decision = resolveEngine(
      ctx({ localAvailable: true, localVision: false, visionRequired: true }),
    );
    expect(decision.target?.kind).toBe("cloud");
  });

  it("stays local when the local engine can read images", () => {
    const decision = resolveEngine(
      ctx({ localAvailable: true, localVision: true, visionRequired: true }),
    );
    expect(decision.target?.kind).toBe("local");
  });
});

describe("the decision is always complete", () => {
  it("returns a reason and a code on every failure, and neither on success", () => {
    const combos: Partial<EngineContext>[] = [
      {},
      { localAvailable: false },
      { localAvailable: false, cloudEntitled: false },
      { preference: "local_only", localAvailable: false },
      { preference: "cloud_only" },
      { privacyMode: "browser_only", localAvailable: false },
      { online: false, localAvailable: false },
    ];
    for (const over of combos) {
      const decision = resolveEngine(ctx(over));
      if (decision.ok) {
        expect(decision.target, JSON.stringify(over)).not.toBeNull();
        expect(decision.reason).toBeNull();
        expect(decision.code).toBeNull();
      } else {
        expect(decision.target).toBeNull();
        expect(decision.reason, JSON.stringify(over)).toBeTruthy();
        expect(decision.code, JSON.stringify(over)).toBeTruthy();
      }
    }
  });

  it("never marks a refusal as consuming allowance", () => {
    // Charging for a request that never ran is the billing bug that loses trust.
    const decision = resolveEngine(ctx({ localAvailable: false, cloudRemaining: 0 }));
    expect(decision.consumesAllowance).toBe(false);
  });
});
