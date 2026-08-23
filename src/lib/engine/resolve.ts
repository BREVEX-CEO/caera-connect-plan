/**
 * The one place that answers "where does this request run?".
 *
 * WHAT WAS WRONG. Six modules could each answer part of that question and none
 * answered all of it:
 *
 *   brain/router            which on-device adapter can serve this?
 *   local/fixed-model       which model OCADE uses (one, everywhere)
 *   local/device-route-policy  hardware profile -> policy
 *   ocade-router            which local runtime, on this device?
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

/**
 * Where a request may run, from the user's settings.
 *
 * Both members mean the same thing now that there is no remote engine, and
 * they are kept apart because they mean different things to the PERSON:
 * "auto" is a user who has not thought about it, "local_only" is a user who
 * has and wants it stated. A settings screen that silently collapses an
 * explicit privacy choice into a default is a settings screen nobody trusts.
 */
export type EnginePreference = "auto" | "local_only";

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
  /** The device has a network path right now. */
  online: boolean;
}

/**
 * One variant, deliberately.
 *
 * A union with a `"cloud"` arm is an invitation: every `switch` over it grows
 * a cloud branch, and one of those branches eventually forgets to check
 * whether cloud was allowed. There is nothing to forget when the type cannot
 * express it.
 */
export type EngineTarget = { kind: "local"; label: string };

/**
 * Why OCADE could not answer, in words a screen can act on.
 *
 * The three cloud codes are gone with the branch that produced them. What
 * replaced them matters more than what left: `local_engine_preparing` is the
 * common case on a first visit and it is NOT an error — the engine is
 * downloading itself and will finish. A product that renders that as "no
 * engine available" sends a user to a settings screen to fix something that
 * is already fixing itself.
 */
export type EngineRefusalCode =
  | "local_only_and_no_local_engine"
  | "vision_unavailable_locally"
  | "local_engine_preparing"
  | "local_engine_unavailable"
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
   * Always false, and kept in the shape on purpose.
   *
   * Screens branched on this to show a "send this to the cloud?" dialog.
   * Removing the field would have made those call sites vanish silently at
   * the type level in some spots and linger in others; leaving it as a
   * permanent `false` makes every remaining branch provably dead, which is
   * what lets the dialogs be deleted with confidence rather than hope.
   */
  needsCloudApproval: false;
  /** Whether this request consumes a paid allowance. On-device never does. */
  consumesAllowance: false;
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
   * Privacy used to be step one because it decided whether the request could
   * leave the device. Nothing leaves the device now, so there is no gate to
   * evaluate and the step is gone rather than left as a no-op.
   *
   * Worth recording why it was never enough on its own: the gate exempted
   * `private_sync`, and `private_sync` is the default privacy mode, so the
   * check that made the product feel safe did not run for the mode almost
   * every conversation used. Privacy modes now decide STORAGE — where the
   * message is written and whether it synchronises — and nothing else.
   */

  /* ------------------------------------------------------- 2. local first -- */
  if (localUsable) {
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

  /* ------------------------------------------ 4. no cloud, and no pretending -- */
  /*
   * THERE IS NO CLOUD BRANCH ANY MORE, AND THAT IS THE POINT.
   *
   * This block used to end in `chooseCloud()` behind four conditions —
   * configured, approved for this conversation, entitled, within allowance.
   * The conditions were real and carefully written, and one of them had a hole
   * big enough to drive the product through: `private_sync` is not
   * vault-backed, `private_sync` is the DEFAULT for every new chat, and so the
   * approval gate that protected the other two privacy modes did not apply to
   * the mode almost every conversation actually used. A prompt in a chat named
   * "private sync" went to Google without a dialog.
   *
   * The hole is not fixed by adding a fifth condition. OCADE's constitution
   * says public-cloud inference is not an allowed fallback at all, so the
   * honest implementation is that the function has no way to say "cloud" —
   * `EngineTarget` has one variant now, and there is no code path, argument or
   * privacy mode that produces a remote engine.
   *
   * What is left is the refusal, and it has to be good, because it is now the
   * only thing standing between a user and silence. It names the real obstacle
   * and the action that clears it.
   */
  if (!context.localAvailable) {
    return refuse(
      context.online ? "local_engine_preparing" : "offline_and_no_local_engine",
      context.online
        ? "OCADE is still preparing its on-device intelligence. This finishes on its own — no setup needed — and Chat will answer as soon as it is ready."
        : "OCADE has no on-device engine yet and this device is offline. Reconnect once and OCADE will prepare itself; after that it works without a connection.",
      localRemedies(context.deviceMode),
    );
  }

  /*
   * The engine is here and still could not serve. On today's device that means
   * one thing, and saying which is the difference between a user who trims an
   * attachment and a user who concludes the product is broken.
   */
  if (context.visionRequired && !context.localVision) {
    return refuse(
      "vision_unavailable_locally",
      "OCADE's on-device engine cannot read images yet. Describe what is in the picture and OCADE can work from that.",
      ["download_model"],
    );
  }

  return refuse(
    "local_engine_unavailable",
    "OCADE could not start its on-device engine for this request.",
    localRemedies(context.deviceMode),
  );
}

/**
 * Kept as an explicit, permanent `false`.
 *
 * Callers used this to decide whether prompting for cloud approval was worth
 * it. Deleting the export would have been tidier and would have moved the
 * decision into whichever screen forgot to delete its dialog; a function that
 * answers "no, and here is why" is harder to route around than an absence.
 */
export function cloudWouldWorkAfterApproval(_context: EngineContext): false {
  return false;
}
