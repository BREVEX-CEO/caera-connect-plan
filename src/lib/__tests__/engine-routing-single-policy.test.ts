import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolveEngine, type EngineContext } from "../engine/resolve";

/**
 * One policy for "may this request leave the device", enforced everywhere.
 *
 * THE TWO LAYERS, WHICH ARE NOT DUPLICATES. `routeBrain` picks WHICH ADAPTER
 * can serve a request — a question about hardware: WebGPU, memory, whether a
 * companion is paired. `resolveEngine` decides WHETHER CLOUD IS PERMITTED — a
 * question about privacy, entitlement and allowance. They stack; neither
 * replaces the other.
 *
 * THE REAL RISK, AND WHAT THIS FILE IS FOR. The signed-in chat used to
 * reimplement the privacy half inline:
 *
 *     if (chatsMode !== "private_sync" && !allowCloud) { askForApproval(); }
 *
 * That was the same rule written twice. The two agreed, and the failure mode
 * was drift: relax one of them — add a mode, add an exemption, flip a default
 * — and a Browser-Only conversation silently reaches a server while the
 * authority still says it must not. That is the one guarantee this product
 * cannot afford to get wrong, and it would not show up as a crash or a failing
 * feature test.
 *
 * The chat now calls `resolveEngine`. These tests hold the refactor in place:
 * the authority must still reach the deleted gate's verdict in every case, and
 * the duplicate must not come back.
 */

const CHAT_SOURCE = readFileSync("src/routes/_authenticated/ocade.tsx", "utf8");

/**
 * Comments stripped.
 *
 * The comment explaining WHY the duplicated gate was removed necessarily
 * quotes it. Matching against raw source would make that explanation register
 * as the defect it documents.
 */
const CHAT = CHAT_SOURCE.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

const BASE: EngineContext = {
  preference: "auto",
  privacyMode: "private_sync",
  deviceMode: "pc_web",
  online: true,
  localAvailable: false,
  localVision: false,
  localLabel: null,
  visionRequired: false,
  cloudConfigured: true,
  cloudEntitled: true,
  cloudRemaining: 5,
  cloudResetsAt: null,
  cloudApprovedForConversation: false,
};

/**
 * The rule the signed-in chat USED to carry inline, kept here as the reference
 * behaviour the refactor had to preserve exactly.
 */
function historicInlineGate(chatsMode: string, allowCloud: boolean): boolean {
  return chatsMode !== "private_sync" && !allowCloud;
}

/** The authority's answer to the same question. */
function authorityAsksApproval(privacyMode: EngineContext["privacyMode"], approved: boolean) {
  const decision = resolveEngine({
    ...BASE,
    privacyMode,
    cloudApprovedForConversation: approved,
  });
  return decision.needsCloudApproval === true;
}

describe("the refactor preserved the rule it replaced", () => {
  /*
   * The signed-in chat now calls `resolveEngine` instead of deciding for
   * itself. This is the regression net for that change: for every combination
   * of privacy mode and prior approval, the authority must reach the same
   * verdict the deleted inline gate did. A refactor of the one guarantee this
   * product cannot get wrong is worth pinning case by case.
   */
  const modes: Array<EngineContext["privacyMode"]> = ["browser_only", "pc_vault", "private_sync"];

  it.each(modes.flatMap((m) => [true, false].map((a) => [m, a] as const)))(
    "%s, approved=%s",
    (mode, approved) => {
      expect(
        historicInlineGate(mode, approved),
        `the refactor changed behaviour for ${mode}/${approved}`,
      ).toBe(authorityAsksApproval(mode, approved));
    },
  );
});

describe("a vault-backed conversation never leaves the device unasked", () => {
  it.each(["browser_only", "pc_vault"] as const)("%s requires explicit approval", (mode) => {
    const decision = resolveEngine({ ...BASE, privacyMode: mode });
    expect(decision.ok).toBe(false);
    expect(decision.needsCloudApproval).toBe(true);
    // Refused by NAME, so the screen can explain rather than fail silently.
    expect(decision.code).toBe("privacy_requires_approval");
  });

  it("proceeds once the user has approved that conversation", () => {
    const decision = resolveEngine({
      ...BASE,
      privacyMode: "browser_only",
      cloudApprovedForConversation: true,
    });
    expect(decision.ok).toBe(true);
  });

  it("does not treat approval of one conversation as approval of the next", () => {
    // The flag is per conversation, which is why it is on the context rather
    // than being read from a global.
    expect(resolveEngine({ ...BASE, privacyMode: "browser_only" }).ok).toBe(false);
  });

  it("prefers a local engine over asking at all", () => {
    const decision = resolveEngine({ ...BASE, privacyMode: "browser_only", localAvailable: true });
    expect(decision.ok).toBe(true);
    expect(decision.needsCloudApproval).toBeFalsy();
    expect(decision.target?.kind).toBe("local");
    // Your own hardware is not metered. This is the rule the product rests on.
    expect(decision.consumesAllowance).toBe(false);
  });
});

describe("the signed-in chat delegates instead of deciding", () => {
  it("calls the authority", () => {
    expect(CHAT).toMatch(/const decision = resolveEngine\(\{/);
    expect(CHAT).toMatch(/from "@\/lib\/engine\/resolve"/);
  });

  it("no longer carries its own copy of the privacy rule", () => {
    /*
     * THE POINT OF THE REFACTOR. A second implementation of "may this leave
     * the device" is a second thing to get wrong, and the two would not
     * announce their disagreement — the product would simply stop keeping its
     * central promise for one of the paths.
     */
    expect(CHAT, "the duplicated privacy gate is back").not.toMatch(
      /chatsMode !== "private_sync" && !allowCloud/,
    );
  });

  it("asks for approval rather than sending, when the authority says so", () => {
    const branch = CHAT.slice(CHAT.indexOf("if (!decision.ok)"));
    expect(branch.slice(0, 400)).toMatch(/decision\.needsCloudApproval/);
    expect(branch.slice(0, 400)).toMatch(/setCloudApprovalNeeded/);
    // It must RETURN — falling through would ask and send anyway.
    expect(branch.slice(0, 400)).toMatch(/return;/);
  });

  it("sends locally only when the authority chose local", () => {
    const local = CHAT.slice(CHAT.indexOf('decision.target?.kind === "local"'));
    expect(local.slice(0, 200)).toMatch(/sendViaLocal/);
  });

  it("decides before it sends", () => {
    // The decision must gate the send, not follow it.
    expect(CHAT.indexOf("const decision = resolveEngine({")).toBeLessThan(
      CHAT.indexOf('decision.target?.kind === "local"'),
    );
  });

  it("passes the real privacy mode rather than a constant", () => {
    // Hardcoding `private_sync` here would disable the whole protection while
    // still looking like a correct delegation.
    const call = CHAT.slice(CHAT.indexOf("const decision = resolveEngine({"));
    expect(call.slice(0, 2400)).toMatch(/privacyMode: chatsMode/);
    expect(call.slice(0, 2400)).toMatch(/cloudApprovedForConversation: allowCloud/);
    expect(call.slice(0, 2400)).toMatch(/online,/);
  });

  it("distinguishes no-engine from no-image-engine", () => {
    // `localVision` is the device's capability, not this message's outcome, so
    // the refusal can say which of the two actually applies.
    const call = CHAT.slice(CHAT.indexOf("const decision = resolveEngine({"));
    expect(call.slice(0, 2400)).toMatch(/localVision: Boolean\(localVisionRoute\?\.ok\)/);
    expect(call.slice(0, 2400)).toMatch(/visionRequired: hasImage/);
  });
});

describe("there is exactly one local-versus-cloud authority", () => {
  it("is the only module that decides cloud permission", () => {
    const source = readFileSync("src/lib/engine/resolve.ts", "utf8");
    for (const code of [
      "privacy_requires_approval",
      "cloud_not_configured",
      "cloud_not_entitled",
      "cloud_allowance_spent",
      "offline_and_no_local_engine",
    ]) {
      expect(source, `${code} is not defined in the authority`).toContain(code);
    }
  });

  /*
   * THE ORDER IS THE POLICY, so it is asserted by behaviour rather than by
   * where the strings sit in the file. A textual check passes on a file that
   * merely mentions the codes in the right sequence, and fails when someone
   * reorders a type union that changes nothing.
   */
  it("prefers local even when cloud is fully available and permitted", () => {
    const decision = resolveEngine({ ...BASE, localAvailable: true, cloudRemaining: 999 });
    expect(decision.target?.kind).toBe("local");
  });

  it("checks privacy before entitlement", () => {
    // Otherwise an unpaid account on a Browser-Only conversation would be told
    // to buy a plan, implying that paying would send its data to the cloud.
    const decision = resolveEngine({
      ...BASE,
      privacyMode: "browser_only",
      cloudEntitled: false,
    });
    expect(decision.code).toBe("privacy_requires_approval");
  });

  it("checks privacy before the allowance", () => {
    const decision = resolveEngine({
      ...BASE,
      privacyMode: "browser_only",
      cloudRemaining: 0,
    });
    expect(decision.code).toBe("privacy_requires_approval");
  });

  it("checks configuration before entitlement", () => {
    // Selling access to something that is not switched on is the wrong answer.
    const decision = resolveEngine({ ...BASE, cloudConfigured: false, cloudEntitled: false });
    expect(decision.code).toBe("cloud_not_configured");
  });

  it("checks entitlement before the allowance", () => {
    const decision = resolveEngine({ ...BASE, cloudEntitled: false, cloudRemaining: 0 });
    expect(decision.code).toBe("cloud_not_entitled");
  });

  it("reports being offline rather than blaming the plan", () => {
    const decision = resolveEngine({ ...BASE, online: false, cloudEntitled: false });
    expect(decision.code).toBe("offline_and_no_local_engine");
  });

  it("never refuses without a code and a sentence to show", () => {
    const refusals: EngineContext[] = [
      { ...BASE, online: false },
      { ...BASE, cloudConfigured: false },
      { ...BASE, cloudEntitled: false },
      { ...BASE, cloudRemaining: 0 },
      { ...BASE, privacyMode: "browser_only" },
      { ...BASE, preference: "local_only" },
    ];
    for (const context of refusals) {
      const decision = resolveEngine(context);
      expect(decision.ok, JSON.stringify(context)).toBe(false);
      expect(decision.code, "a silent refusal").toBeTruthy();
      // Shown verbatim, so it must be a sentence and never a code.
      expect(decision.reason, "a refusal with nothing to show").toBeTruthy();
      expect(decision.reason).not.toBe(decision.code);
    }
  });
});
