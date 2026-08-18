import type { RemedyAction } from "../brain/adapter";
import type { DeviceMode } from "../brain/device-mode";

/**
 * Single authority for where a request executes.
 *
 * OCADE IS LOCAL-ONLY. This module intentionally never returns a cloud target.
 * Legacy cloud-shaped fields remain accepted temporarily so older UI code can
 * compile while it is removed; they are ignored by the decision.
 */
export type EnginePreference = "auto" | "local_only" | "cloud_only";
export type PrivacyMode = "browser_only" | "pc_vault" | "private_sync";

export interface EngineContext {
  preference: EnginePreference;
  privacyMode: PrivacyMode;
  deviceMode: DeviceMode;
  localAvailable: boolean;
  localLabel: string | null;
  localVision: boolean;
  visionRequired: boolean;
  online: boolean;
  /** Legacy compatibility only. Never used to route AI. */
  cloudConfigured?: boolean;
  cloudEntitled?: boolean;
  cloudRemaining?: number;
  cloudResetsAt?: Date | null;
  cloudApprovedForConversation?: boolean;
}

/**
 * `cloud` stays in this type only while older screens are compiled. The router
 * never constructs it. This prevents a stale UI branch from becoming a type
 * error during the migration while the server endpoint independently returns
 * HTTP 410.
 */
export type EngineTarget =
  | { kind: "local"; label: string }
  | { kind: "cloud"; label: "OCADE Cloud" };

export type EngineRefusalCode =
  | "local_only_and_no_local_engine"
  | "vision_unavailable_locally"
  | "offline_and_no_local_engine"
  | "cloud_routing_removed";

export interface EngineDecision {
  ok: boolean;
  target: EngineTarget | null;
  reason: string | null;
  code: EngineRefusalCode | null;
  remedies: RemedyAction[];
  needsCloudApproval: boolean;
  consumesAllowance: boolean;
}

function localRemedies(mode: DeviceMode): RemedyAction[] {
  switch (mode) {
    case "pc_web":
      return ["install_ocade", "download_model"];
    case "mobile_web":
    case "mobile_app":
      return ["pair_a_computer", "download_model"];
    case "pc_web_paired":
      return ["start_engine", "download_model"];
    case "desktop_app":
      return ["start_engine", "download_model"];
    default:
      return [];
  }
}

function refuse(
  code: EngineRefusalCode,
  reason: string,
  remedies: RemedyAction[],
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

export function resolveEngine(context: EngineContext): EngineDecision {
  // A persisted old preference must fail closed; it can never revive cloud AI.
  if (context.preference === "cloud_only") {
    return refuse(
      "cloud_routing_removed",
      "Cloud AI routing has been removed from OCADE. Select OCADE Local and start or download the on-device engine.",
      localRemedies(context.deviceMode),
    );
  }

  if (context.localAvailable) {
    if (context.visionRequired && !context.localVision) {
      return refuse(
        "vision_unavailable_locally",
        "This request needs image understanding, but no on-device vision engine is available. OCADE will not send the image to a cloud model.",
        ["download_model"],
      );
    }
    return {
      ok: true,
      target: { kind: "local", label: context.localLabel ?? "OCADE Local" },
      reason: null,
      code: null,
      remedies: [],
      needsCloudApproval: false,
      consumesAllowance: false,
    };
  }

  return refuse(
    context.online ? "local_only_and_no_local_engine" : "offline_and_no_local_engine",
    context.online
      ? "No on-device OCADE engine is ready. Start the local engine or download the model; OCADE will not fall back to a cloud model."
      : "This device is offline and no on-device OCADE engine is ready. Reconnect once to finish the local model download; interrupted downloads retry and resume automatically.",
    localRemedies(context.deviceMode),
  );
}

/** Cloud is architecturally unavailable; approval can never make it available. */
export function cloudWouldWorkAfterApproval(_context: EngineContext): false {
  return false;
}
