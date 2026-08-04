import {
  type AdapterAvailability,
  type AdapterId,
  type BrainAdapter,
  type RemedyAction,
} from "./adapter";
import { preferenceFor, type DeviceMode } from "./device-mode";

/**
 * Choose which engine answers, and refuse honestly when none can.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: when no engine on the ordered list is
 * available and cloud is off, OCADE says so and offers something the user can
 * actually do. It does not quietly reach for the cloud, and it does not
 * produce an answer from nowhere. A local-first product that silently uploads
 * when things get hard is not a local-first product; it is a cloud product
 * with a good mood.
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
  /** Shown verbatim. Names the situation, not an error code. */
  reason: string;
  /** Deduplicated, in the order they were encountered. Render as buttons. */
  remedies: RemedyAction[];
  attempts: RouteAttempt[];
  mode: DeviceMode;
  /** True when cloud would have served this but is switched off. */
  cloudWouldHelp: boolean;
}

export type RouteOutcome = RouteChosen | RouteRefused;

export interface RouteInput {
  mode: DeviceMode;
  /** Registry of every adapter this build knows about. */
  adapters: Map<AdapterId, BrainAdapter>;
  /** Work that a phone should hand to a paired machine when it has one. */
  heavy?: boolean;
  /** Image understanding is required; adapters without vision are skipped. */
  visionRequired?: boolean;
  /** Whether the user has switched cloud on. Never assumed. */
  cloudEnabled?: boolean;
}

/**
 * The refusal sentence.
 *
 * Written per device mode because the useful next step genuinely differs: a
 * browser on a laptop can install the desktop app, a phone should pair with a
 * computer, and a machine that already has OCADE probably just needs its
 * engine started. One generic "no engine available" would be true everywhere
 * and useful nowhere.
 */
function refusalFor(mode: DeviceMode, hasAnyRemedy: boolean): string {
  switch (mode) {
    case "desktop_app":
      return "OCADE could not reach an engine on this computer, so it has not answered.";
    case "mobile_app":
      return "OCADE has no engine ready on this phone and no paired computer to borrow, so it has not answered.";
    case "mobile_web":
      return "This phone's browser cannot run OCADE's engine, so it has not answered. OCADE will not send your conversation to a server without being told to.";
    case "pc_web_paired":
    case "pc_web":
    default:
      return hasAnyRemedy
        ? "This browser cannot run OCADE's engine, so it has not answered. OCADE will not send your conversation to a server without being told to."
        : "No engine is available to answer, and OCADE will not invent a reply.";
  }
}

/**
 * Remedies OCADE can always offer for a mode, on top of whatever the adapters
 * suggested. A browser that simply cannot run a model has no adapter-level
 * remedy at all, and "nothing you can do" is a bad place to leave someone.
 */
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
      // A probe that throws is a broken adapter, not an unavailable device.
      // Recorded as such rather than being allowed to abort the whole route.
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

    // Vision is a hard requirement, never a nice-to-have: handing an image to
    // a text-only model produces a confident answer about nothing.
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
    // Stated so the UI can offer the cloud switch where it would genuinely
    // help — without OCADE flipping it on anybody's behalf.
    cloudWouldHelp: !input.cloudEnabled,
  };
}

/** One line explaining a completed route, for diagnostics. */
export function explainRoute(outcome: RouteOutcome): string {
  if (outcome.ok) {
    const skipped = outcome.attempts.length - 1;
    return skipped > 0
      ? `${outcome.availability.label} answered, after ${skipped} unavailable engine${skipped === 1 ? "" : "s"}.`
      : `${outcome.availability.label} answered.`;
  }
  return outcome.reason;
}
