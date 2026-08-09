/**
 * The one place that answers "where does this request run?".
 *
 * WHAT WAS WRONG. Six modules could each answer part of that question and none
 * answered all of it:
 *
 *   brain/router            which on-device adapter can serve this?
 *   local/router-policy     which model inside a local runtime?
 *   local/tier-policy       which model tier does this hardware allow?
 *   local/device-route-policy  hardware profile -> policy
 *   ocade-router            which cloud provider, server-side?
 *   reasoning/engine        a wrapper that called some of the above
 *
 * They are not duplicates — they work at different levels — but they were
 * PARALLEL ENTRY POINTS. A caller had to know which one to ask, and nothing
 * combined them, so the rules that span levels lived nowhere: privacy mode
 * never reached the adapter choice, the cloud allowance never reached the
 * refusal message, and "ask before cloud" was implemented once in the chat
 * screen and not at all anywhere else.
 *
 * This module is the single authority. The others become the steps it runs, in
 * order, and callers ask exactly one question.
 *
 * THE ORDER IS THE POLICY, and it is deliberate:
 *
 *   1. PRIVACY FIRST. A vault-backed conversation cannot leave the device
 *      without explicit per-conversation approval, so that gate is evaluated
 *      before anything else. Deciding an engine and then discovering privacy
 *      forbids it is how a request leaks.
 *   2. LOCAL NEXT. If an on-device engine can serve it, it does. Always.
 *   3. CLOUD ONLY IF ALLOWED, APPROVED AND WITHIN ALLOWANCE — three separate
 *      conditions with three separate refusals, because "cloud unavailable"
 *      tells nobody which one to fix.
 *   4. REFUSE, NAMING THE REMEDY. Never a silent substitution.
 *
 * Pure. Every input is a parameter, so all fifteen branches are reachable from
 * a test on one laptop.
 */
import type { RemedyAction } from "../brain/adapter";
import type { DeviceMode } from "../brain/device-mode";

/** Where a request may run, from the user's settings. */
export type EnginePreference =
  /** Prefer local, use cloud when local cannot serve and the user allows it. */
  | "auto"
  /** Never leave the device. Refuse rather than use cloud. */
  | "local_only"
  /** Always use cloud, even when a local engine exists. */
  | "cloud_only";

/** How the conversation's messages are stored, which gates cloud transfer. */
export type PrivacyMode = "browser_only" | "pc_vault" | "private_sync";

export interface EngineContext {
  preference: EnginePreference;
  privacyMode: PrivacyMode;
  deviceMode: DeviceMode;
  /** An on-device adapter reported itself ready. */
  localAvailable: boolean;
  /** Capability label of that adapter — "OCADE Local Fast", never a model id. */
  localLabel: string | null;
  /** The local adapter can read images. */
  localVision: boolean;
  /** This request needs image understanding. */
  visionRequired: boolean;
  /** A cloud provider is configured on this deployment. */
  cloudConfigured: boolean;
  /** The account's plan permits cloud at all. */
  cloudEntitled: boolean;
  /** Cloud requests left in this window. */
  cloudRemaining: number;
  /** When the allowance resets. Shown in the refusal. */
  cloudResetsAt: Date | null;
  /**
   * The user approved cloud for THIS conversation.
   *
   * Asked once per conversation and remembered, so a vault-backed chat does
   * not interrogate the user on every message — and can be revoked.
   */
  cloudApprovedForConversation: boolean;
  /** The device has a network path right now. */
  online: boolean;
}

export type EngineTarget =
  { kind: "local"; label: string } | { kind: "cloud"; label: "OCADE Cloud" };

export type EngineRefusalCode =
  | "local_only_and_no_local_engine"
  | "privacy_requires_approval"
  | "vision_unavailable_locally"
  | "cloud_not_configured"
  | "cloud_not_entitled"
  | "cloud_allowance_spent"
  | "offline_and_no_local_engine"
  | "no_engine_at_all";

export interface EngineDecision {
  ok: boolean;
  target: EngineTarget | null;
  /** Present when `ok` is false. Shown verbatim; never a code. */
  reason: string | null;
  code: EngineRefusalCode | null;
  /** What the user can do about it. Rendered as buttons. */
  remedies: RemedyAction[];
  /**
   * True when the ONLY thing standing between the user and an answer is a
   * per-conversation cloud approval. The screen shows a prompt rather than a
   * dead end.
   */
  needsCloudApproval: boolean;
  /** Whether this request will consume allowance. Local never does. */
  consumesAllowance: boolean;
}

function refuse(
  code: EngineRefusalCode,
  reason: string,
  remedies: RemedyAction[] = [],
): EngineDecision {
  return {
    ok: false,
    target: null,
    reason,
    code,
    remedies,
    needsCloudApproval: false,
    consumesAllowance: false,
  };
}

/*
 * Named `chooseLocal` rather than `useLocal`: a plain function whose name
 * begins with "use" is treated as a React hook by the rules-of-hooks lint, and
 * this module is deliberately free of React.
 */
function chooseLocal(label: string): EngineDecision {
  return {
    ok: true,
    target: { kind: "local", label },
    reason: null,
    code: null,
    remedies: [],
    needsCloudApproval: false,
    // The rule the whole product rests on: your own hardware is not metered.
    consumesAllowance: false,
  };
}

function chooseCloud(): EngineDecision {
  return {
    ok: true,
    target: { kind: "cloud", label: "OCADE Cloud" },
    reason: null,
    code: null,
    remedies: [],
    needsCloudApproval: false,
    consumesAllowance: true,
  };
}

/** Remedies that would make an on-device engine appear, per device mode. */
function localRemedies(mode: DeviceMode): RemedyAction[] {
  switch (mode) {
    case "pc_web":
      return ["install_ocade", "download_model"];
    case "mobile_web":
    case "mobile_app":
      return ["pair_a_computer"];
    case "pc_web_paired":
      return ["start_engine"];
    case "desktop_app":
      return ["start_engine", "download_model"];
    default:
      return [];
  }
}

/**
 * Decide where one request runs.
 *
 * Never throws, never returns a partial answer, and never picks cloud without
 * having checked every condition that could forbid it.
 */
export function resolveEngine(context: EngineContext): EngineDecision {
  const localUsable = context.localAvailable && (!context.visionRequired || context.localVision);

  /* ---------------------------------------------------------- 1. privacy -- */
  /*
   * A browser-vault or PC-vault conversation is stored on the device by the
   * user's choice. Sending it to cloud contradicts that choice, so it needs an
   * explicit approval for THIS conversation — checked before an engine is
   * chosen, because choosing first and checking later is how a request leaks.
   */
  const vaultBacked = context.privacyMode !== "private_sync";
  const cloudForbiddenByPrivacy = vaultBacked && !context.cloudApprovedForConversation;

  /* ------------------------------------------------------- 2. local first -- */
  if (context.preference !== "cloud_only" && localUsable) {
    return chooseLocal(context.localLabel ?? "OCADE Local");
  }

  /* --------------------------------------------- 3. why local was not used -- */
  if (context.preference === "local_only") {
    if (context.visionRequired && context.localAvailable && !context.localVision) {
      return refuse(
        "vision_unavailable_locally",
        "This device's engine cannot read images, and OCADE is set to stay on this device.",
        ["download_model"],
      );
    }
    return refuse(
      "local_only_and_no_local_engine",
      "No engine is available on this device, and OCADE is set never to use the cloud.",
      localRemedies(context.deviceMode),
    );
  }

  /* --------------------------------------------------------- 4. the cloud -- */
  if (!context.online) {
    // Distinguished from "no engine": the fix is a connection, or a model
    // downloaded while one exists.
    return refuse(
      "offline_and_no_local_engine",
      "This device is offline and has no on-device engine, so OCADE cannot answer yet. Download a local engine while you have a connection and it will work anywhere.",
      localRemedies(context.deviceMode),
    );
  }

  if (!context.cloudConfigured) {
    return refuse(
      "cloud_not_configured",
      "OCADE Cloud is not configured on this deployment, and no engine is available on this device.",
      localRemedies(context.deviceMode),
    );
  }

  if (cloudForbiddenByPrivacy) {
    /*
     * NOT a refusal in the dead-end sense. The user can approve, so the screen
     * shows a prompt. Marked separately from every other failure so a caller
     * cannot accidentally render it as "unavailable".
     */
    return {
      ok: false,
      target: null,
      code: "privacy_requires_approval",
      reason:
        "This conversation is stored on your device. Approve sending it to OCADE Cloud for this conversation, or keep it here and use an on-device engine.",
      remedies: [],
      needsCloudApproval: true,
      consumesAllowance: false,
    };
  }

  if (!context.cloudEntitled) {
    return refuse(
      "cloud_not_entitled",
      "Your plan does not include OCADE Cloud. On-device processing stays unlimited.",
      localRemedies(context.deviceMode),
    );
  }

  if (context.cloudRemaining <= 0) {
    const resets = context.cloudResetsAt
      ? ` It resets at ${context.cloudResetsAt.toLocaleTimeString()}.`
      : "";
    return refuse(
      "cloud_allowance_spent",
      `You have used this window's OCADE Cloud allowance.${resets} On-device processing is unlimited — install a local engine to keep working now.`,
      localRemedies(context.deviceMode),
    );
  }

  return chooseCloud();
}

/**
 * Would this context allow cloud if the user approved it?
 *
 * Used to decide whether asking is worth it. Prompting for permission and then
 * refusing for a different reason is the worst possible sequence.
 */
export function cloudWouldWorkAfterApproval(context: EngineContext): boolean {
  const decision = resolveEngine({ ...context, cloudApprovedForConversation: true });
  return decision.ok && decision.target?.kind === "cloud";
}
