import {
  type AdapterAvailability,
  type AdapterId,
  type BrainAdapter,
  type RemedyAction,
} from "./adapter";
import { preferenceFor, type DeviceMode } from "./device-mode";

/**
 * Choose which on-device / paired-local engine answers, and refuse honestly
 * when none can. There is no public cloud-model fallback in OCADE.
 */

export interface RouteAttempt {
  id: AdapterId;
  availability: AdapterAvailability;
}

export interface RouteChosen {
  ok: true;
  adapter: BrainAdapter;
  availability: Extract<AdapterAvailability, { available: true }>;
  /** Every adapter tried before this one, with why it was passed over. */
  attempts: RouteAttempt[];
  mode: DeviceMode;
}

export interface RouteRefused {
  ok: false;
  reason: string;
  remedies: RemedyAction[];
  attempts: RouteAttempt[];
  mode: DeviceMode;
  /** Compatibility field. Cloud AI never serves OCADE, so this is always false. */
  cloudWouldHelp: false;
}

export type RouteOutcome = RouteChosen | RouteRefused;

export interface RouteInput {
  mode: DeviceMode;
  adapters: Map<AdapterId, BrainAdapter>;
  heavy?: boolean;
  visionRequired?: boolean;
  /** Legacy compatibility only; ignored. Cloud AI is architecturally disabled. */
  cloudEnabled?: boolean;
}

function refusalFor(mode: DeviceMode, hasAnyRemedy: boolean): string {
  switch (mode) {
    case "desktop_app":
      return "OCADE could not reach an engine on this computer, so it has not answered. Start or repair the local engine.";
    case "mobile_app":
      return "OCADE has no local engine ready on this phone and no paired computer to borrow, so it has not answered.";
    case "mobile_web":
      return "This phone's browser cannot run OCADE's local engine, so it has not answered. OCADE will not send the conversation to a cloud model.";
    case "pc_web_paired":
    case "pc_web":
    default:
      return hasAnyRemedy
        ? "No local OCADE engine is ready in this browser. Start/download a local engine or use an approved paired computer; no cloud-model fallback exists."
        : "No local engine is available to answer, and OCADE will not invent or remotely route a reply.";
  }
}

function baselineRemedies(mode: DeviceMode): RemedyAction[] {
  switch (mode) {
    case "pc_web":
    case "pc_web_paired":
      return ["install_ocade", "pair_a_computer"];
    case "mobile_web":
      return ["install_ocade", "pair_a_computer"];
    case "mobile_app":
      return ["pair_a_computer"];
    case "desktop_app":
      return ["start_engine"];
    default:
      return [];
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
        reason: `${adapter.displayName} could not report its status: ${
          error instanceof Error ? error.message : String(error)
        }`,
        remedies: [],
      };
    }

    attempts.push({ id, availability });
    if (!availability.available) continue;
    if (input.visionRequired && !availability.capabilities.vision) continue;

    return { ok: true, adapter, availability, attempts, mode: input.mode };
  }

  const fromAdapters = attempts
    .filter((a) => !a.availability.available)
    .flatMap((a) => (a.availability as { remedies: RemedyAction[] }).remedies);
  const remedies = [...new Set([...fromAdapters, ...baselineRemedies(input.mode)])];

  return {
    ok: false,
    reason: refusalFor(input.mode, remedies.length > 0),
    remedies,
    attempts,
    mode: input.mode,
    cloudWouldHelp: false,
  };
}

export function explainRoute(outcome: RouteOutcome): string {
  if (outcome.ok) {
    const skipped = outcome.attempts.length - 1;
    return skipped > 0
      ? `${outcome.availability.label} answered, after ${skipped} unavailable engine${skipped === 1 ? "" : "s"}.`
      : `${outcome.availability.label} answered.`;
  }
  return outcome.reason;
}
