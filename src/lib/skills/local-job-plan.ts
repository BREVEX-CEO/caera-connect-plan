/**
 * OCADE local-job planner — the execution-path consumer that composes the
 * hardware-profile recommender (§6.3) and the resource governor (§23.5) into
 * one decision: can this job run locally, on what profile, and how?
 *
 * Neither library is used blind. This orchestrator asks them in the order that
 * matters:
 *
 *  1. Which local profile does this machine support at all? (hardware-profile)
 *  2. Given the job's cost, does it fit that profile's headroom, and does the
 *     machine's state (thermal, battery, disk) allow starting it? (resource
 *     governor)
 *
 * The honesty carries straight through: if no local profile fits, the answer is
 * "use cloud (with consent)", not a forced local run; if a profile fits but the
 * job is too big or the machine too hot, the governor's defer/downgrade/refuse
 * verdict is returned verbatim. Nothing here overrides either library's refusal.
 */
import { recommendProfile, type LocalProfile } from "./hardware-profile";
import {
  governResources,
  type JobSpec,
  type HardwareSnapshot,
  type Recommendation,
} from "./resource-governor";

export type PlanOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export type LocalJobDecision =
  /** Run locally on the named profile, with the governor's go-ahead. */
  | { where: "local"; profileId: string; profileLabel: string; recommendation: Recommendation }
  /** Run locally, but only after installing a profile the user must approve. */
  | { where: "needs_install"; profileLabel: string; reason: string }
  /** The governor blocked it (over budget / too hot / low battery). */
  | { where: "blocked"; recommendation: Recommendation }
  /** Nothing local fits; cloud is the honest fallback (with consent). */
  | { where: "cloud"; reason: string };

/**
 * Decide where and how to run a job.
 *
 * Composes the two governors; returns their combined verdict without softening
 * either one's refusal.
 */
export function planLocalJob(
  job: JobSpec,
  hw: HardwareSnapshot,
  profiles: LocalProfile[],
): PlanOutcome<LocalJobDecision> {
  const profile = recommendProfile(hw, profiles);
  if (!profile.ok) return profile;

  // No local profile fits the machine at all → cloud (with consent).
  if (profile.data.needsCloud) {
    return {
      ok: true,
      data: { where: "cloud", reason: profile.data.recommendation },
      evidence: "No local profile fits; recommending cloud.",
    };
  }

  // A profile fits, but none is installed yet → install (needs approval) first.
  if (!profile.data.ready && profile.data.installable) {
    return {
      ok: true,
      data: {
        where: "needs_install",
        profileLabel: profile.data.installable.label,
        reason: profile.data.recommendation,
      },
      evidence: `Best fit ${profile.data.installable.label} needs installation (with approval).`,
    };
  }

  const ready = profile.data.ready;
  if (!ready) {
    // Fits but neither ready nor installable-with-approval — treat as cloud
    // rather than assume something runnable.
    return {
      ok: true,
      data: { where: "cloud", reason: profile.data.recommendation },
      evidence: "No runnable local profile; recommending cloud.",
    };
  }

  // A ready profile exists — now let the resource governor rule on THIS job.
  const gov = governResources(job, hw);
  if (!gov.ok) return gov;

  if (gov.data.action === "proceed" || gov.data.action === "checkpoint_first") {
    return {
      ok: true,
      data: {
        where: "local",
        profileId: ready.id,
        profileLabel: ready.label,
        recommendation: gov.data,
      },
      evidence: `Run locally on ${ready.label}: ${gov.data.reason}`,
    };
  }

  // defer / downgrade / refuse — the governor blocked or qualified it. Pass
  // the verdict through unchanged; the caller acts on it.
  return {
    ok: true,
    data: { where: "blocked", recommendation: gov.data },
    evidence: `Governor ${gov.data.action}: ${gov.data.reason}`,
  };
}
