import {
  type AdapterAvailability,
  type AdapterId,
  type BrainAdapter,
  type RemedyAction,
} from "./adapter";
import { preferenceFor, type DeviceMode } from "./device-mode";

export interface RouteAttempt {
  id: AdapterId;
  availability: AdapterAvailability;
}
export interface RouteChosen {
  ok: true;
  adapter: BrainAdapter;
  availability: Extract<AdapterAvailability, { available: true }>;
  attempts: RouteAttempt[];
  mode: DeviceMode;
}
export interface RouteRefused {
  ok: false;
  reason: string;
  remedies: RemedyAction[];
  attempts: RouteAttempt[];
  mode: DeviceMode;
}
export type RouteOutcome = RouteChosen | RouteRefused;
export interface RouteInput {
  mode: DeviceMode;
  adapters: Map<AdapterId, BrainAdapter>;
  heavy?: boolean;
  visionRequired?: boolean;
}

function refusalFor(mode: DeviceMode): string {
  switch (mode) {
    case "desktop_app":
      return "No on-device OCADE engine is ready on this computer. Start the engine or retry the model download; OCADE has no cloud fallback.";
    case "mobile_app":
      return "No on-device OCADE engine is ready on this phone and no paired device can serve it. OCADE has not sent the request anywhere else.";
    case "mobile_web":
      return "This browser cannot run OCADE's local engine right now. OCADE has not sent the conversation to any server or cloud model.";
    case "pc_web_paired":
    case "pc_web":
    default:
      return "No on-device OCADE engine is ready. Start/download the local engine; OCADE will not route the request to a cloud model.";
  }
}

function baselineRemedies(mode: DeviceMode): RemedyAction[] {
  switch (mode) {
    case "pc_web":
    case "pc_web_paired":
      return ["install_ocade", "download_model", "pair_a_computer"];
    case "mobile_web":
      return ["download_model", "pair_a_computer"];
    case "mobile_app":
      return ["download_model", "pair_a_computer"];
    case "desktop_app":
      return ["start_engine", "download_model"];
  }
}

export async function routeBrain(input: RouteInput): Promise<RouteOutcome> {
  const order = preferenceFor(input.mode, input.heavy ?? false);
  const attempts: RouteAttempt[] = [];
  for (const id of order) {
    const adapter = input.adapters.get(id);
    if (!adapter) continue;
    let availability: AdapterAvailability;
    try {
      availability = await adapter.probe();
    } catch (error) {
      availability = {
        available: false,
        code: "probe_failed",
        reason: `${adapter.displayName} could not report its status: ${error instanceof Error ? error.message : String(error)}`,
        remedies: [],
      };
    }
    attempts.push({ id, availability });
    if (!availability.available) continue;
    if (input.visionRequired && !availability.capabilities.vision) continue;
    return { ok: true, adapter, availability, attempts, mode: input.mode };
  }

  const fromAdapters = attempts
    .filter((attempt) => !attempt.availability.available)
    .flatMap((attempt) => (attempt.availability as { remedies: RemedyAction[] }).remedies);
  return {
    ok: false,
    reason: refusalFor(input.mode),
    remedies: [...new Set([...fromAdapters, ...baselineRemedies(input.mode)])],
    attempts,
    mode: input.mode,
  };
}

export function explainRoute(outcome: RouteOutcome): string {
  if (!outcome.ok) return outcome.reason;
  const skipped = outcome.attempts.length - 1;
  return skipped > 0
    ? `${outcome.availability.label} answered after ${skipped} unavailable local engine${skipped === 1 ? "" : "s"}.`
    : `${outcome.availability.label} answered.`;
}
