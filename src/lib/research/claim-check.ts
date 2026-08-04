/**
 * OCADE Research — deciding what may be asserted.
 *
 * Ranking sources tells you which are worth reading. This module decides what
 * OCADE is allowed to *say* on the strength of them, and refuses when the
 * honest answer is "the evidence doesn't support that".
 *
 * THE INCIDENT RULE.
 *
 * The strictest rule here concerns claims about accidents, emergencies,
 * casualties and causes. Sensor data — a traffic layer gone red, a satellite
 * image, a slowdown on a motorway — is precise about *what it measured* and
 * silent about *why*. Red on a map means vehicles are moving slowly. It does
 * not mean there has been a crash; it equally means roadworks, a match letting
 * out, a burst water main, or a sensor fault.
 *
 * An agent that reports "there's been an accident" from a red road has invented
 * the most alarming explanation for an ambiguous signal, and phrased it as
 * observation. Someone may act on that — call a relative, change route, panic.
 * So `assessIncidentClaim` refuses categorically: an incident, its cause, or
 * any casualty claim requires an official source that states it. No quantity of
 * sensor data substitutes, and no confidence score is offered in its place,
 * because a number would invite the reader to round it up.
 */
import { freshnessOf, independentSources, authorityFor, type SourceRecord } from "./source-ranking";

export type Confidence =
  /** Multiple independent sources, at least one authoritative, all current. */
  | "well_supported"
  /** Real support, with a stated weakness. */
  | "supported"
  /** One source, or only weak ones. Say so prominently. */
  | "single_source"
  /** Sources disagree. Report the disagreement, never pick a side silently. */
  | "contested"
  /** Not assertable. */
  | "unsupported";

export interface Claim {
  /** The statement being checked, as it would be shown to the user. */
  text: string;
  /** Subject area, used for topic-specific authority. */
  topic: string;
  /** Sources that support the claim. */
  supporting: SourceRecord[];
  /** Sources that contradict it. Never discarded. */
  contradicting?: SourceRecord[];
}

export interface Assessment {
  confidence: Confidence;
  /** What OCADE may state, in the words it should use. */
  statement: string;
  /** Independent supporting sources, after collapsing syndication. */
  independentSupport: number;
  /** Named uncertainties. Empty only when there genuinely are none. */
  uncertainties: string[];
  /** ISO timestamp of the most recent supporting source, when dated. */
  asOf: string | null;
}

/* ----------------------------------------------------------- general claims -- */

/**
 * Assess an ordinary factual claim.
 *
 * Contradiction is never resolved by weight of numbers alone: when sources
 * disagree, the disagreement IS the finding, and burying it under a majority
 * count would hide the thing the user most needs to know.
 */
export function assessClaim(claim: Claim, now: Date = new Date()): Assessment {
  const support = independentSources(claim.supporting);
  const against = independentSources(claim.contradicting ?? []);
  const uncertainties: string[] = [];

  const dated = support
    .map((s) => ({ s, f: freshnessOf(s, now) }))
    .filter(
      (
        x,
      ): x is {
        s: SourceRecord;
        f: { ok: true; data: { ageMs: number; label: string; stale: boolean }; evidence: string };
      } => x.f.ok,
    );

  const undatedCount = support.length - dated.length;
  if (undatedCount > 0) {
    uncertainties.push(
      `${undatedCount} supporting source${undatedCount === 1 ? " carries" : "s carry"} no publication date, so ${undatedCount === 1 ? "it" : "they"} can't be confirmed as current.`,
    );
  }

  const syndicated = claim.supporting.length - support.length;
  if (syndicated > 0) {
    uncertainties.push(
      `${syndicated} of the ${claim.supporting.length} results were the same reporting republished, so they count once rather than as separate confirmation.`,
    );
  }

  const freshest =
    dated.length > 0 ? dated.reduce((a, b) => (b.f.data.ageMs < a.f.data.ageMs ? b : a)) : null;
  const asOf = freshest ? freshest.s.publishedAt!.toISOString() : null;

  if (freshest && freshest.f.data.stale) {
    uncertainties.push(
      `The most recent supporting source is ${freshest.f.data.label}, so this may no longer hold.`,
    );
  }

  const bestAuthority =
    support.length > 0 ? Math.max(...support.map((s) => authorityFor(s, claim.topic))) : 0;
  const hasAuthoritative = bestAuthority >= 0.7;
  if (support.length > 0 && !hasAuthoritative) {
    uncertainties.push(
      "No source with accountability for this subject was found — this rests on secondary reporting.",
    );
  }

  if (support.length === 0) {
    return {
      confidence: "unsupported",
      statement: `OCADE found nothing that supports this, so it won't state it: ${claim.text}`,
      independentSupport: 0,
      uncertainties: ["No supporting source at all."],
      asOf: null,
    };
  }

  if (against.length > 0) {
    // Disagreement is reported, never arbitrated by counting.
    return {
      confidence: "contested",
      statement: `Sources disagree about this. ${support.length} say it, ${against.length} contradict it — including ${against[0].publisher}. OCADE won't pick a side for you.`,
      independentSupport: support.length,
      uncertainties: [
        ...uncertainties,
        `Contradicted by ${against.map((s) => s.publisher).join(", ")}.`,
      ],
      asOf,
    };
  }

  if (support.length === 1) {
    return {
      confidence: "single_source",
      statement: `Only ${support[0].publisher} reports this, so treat it as unconfirmed: ${claim.text}`,
      independentSupport: 1,
      uncertainties: [...uncertainties, "Nothing independent corroborates it."],
      asOf,
    };
  }

  const wellSupported = support.length >= 2 && hasAuthoritative && uncertainties.length === 0;
  return {
    confidence: wellSupported ? "well_supported" : "supported",
    statement: claim.text,
    independentSupport: support.length,
    uncertainties,
    asOf,
  };
}

/* ---------------------------------------------------------- incident claims -- */

export type IncidentKind = "accident" | "emergency" | "casualty" | "cause" | "closure";

export interface IncidentClaim {
  kind: IncidentKind;
  /** What is being asserted, e.g. "a collision on the A38". */
  text: string;
  location: string;
  sources: SourceRecord[];
}

export type IncidentOutcome =
  | { ok: true; statement: string; asOf: string; official: string }
  | { ok: false; reason: string; mayInsteadSay: string };

/** Sources that can establish that an incident happened. */
const CAN_ESTABLISH_INCIDENT: ReadonlySet<string> = new Set(["official", "primary_party"]);

/**
 * Decide whether OCADE may state that an incident has occurred.
 *
 * Refuses unless an official or directly-involved source says so. See the
 * module header for why sensor data — however much of it — never suffices.
 *
 * `mayInsteadSay` is not a consolation prize: it is the honest observation the
 * sensor data actually supports, so the caller has something true to say rather
 * than being left with nothing and reaching for the inference anyway.
 */
export function assessIncidentClaim(claim: IncidentClaim, now: Date = new Date()): IncidentOutcome {
  const independent = independentSources(claim.sources);
  const official = independent.find((s) => CAN_ESTABLISH_INCIDENT.has(s.kind));

  const sensors = independent.filter((s) => s.kind === "sensor");
  const observation =
    sensors.length > 0
      ? `Traffic near ${claim.location} is moving slowly according to ${sensors.map((s) => s.publisher).join(", ")}. That is what the data shows; it does not say why. Roadworks, an event, weather or a sensor fault would look the same.`
      : `OCADE has no official information about ${claim.location}.`;

  if (!official) {
    return {
      ok: false,
      reason:
        sensors.length > 0
          ? `OCADE won't report ${describeKind(claim.kind)} from traffic or imagery data. A slow road means vehicles are slow — it doesn't say an incident happened, and guessing the most alarming explanation is how people are frightened by something that isn't there. Check the local emergency service or traffic authority.`
          : `No official source reports ${describeKind(claim.kind)} near ${claim.location}, so OCADE won't state it.`,
      mayInsteadSay: observation,
    };
  }

  const f = freshnessOf(official, now);
  if (!f.ok) {
    return {
      ok: false,
      reason: `${official.publisher} reports this but doesn't say when, and an undated emergency report can't be presented as current.`,
      mayInsteadSay: `${official.publisher} has reported ${claim.text}, but the report carries no timestamp — check it directly before acting on it.`,
    };
  }
  if (f.data.stale) {
    return {
      ok: false,
      reason: `The only official report is ${f.data.label}, which is too old to describe the situation now.`,
      mayInsteadSay: `${official.publisher} reported ${claim.text} ${f.data.label}. That may well be resolved — check for a current update.`,
    };
  }

  return {
    ok: true,
    statement: `${official.publisher} reports ${claim.text} near ${claim.location}, as of ${f.data.label}.`,
    asOf: official.publishedAt!.toISOString(),
    official: official.publisher,
  };
}

function describeKind(kind: IncidentKind): string {
  switch (kind) {
    case "accident":
      return "an accident";
    case "emergency":
      return "an emergency";
    case "casualty":
      return "injuries or casualties";
    case "cause":
      return "a cause";
    case "closure":
      return "a road closure";
  }
}

/* ---------------------------------------------------------------- rendering -- */

/**
 * The line OCADE shows beneath an answer.
 *
 * Timestamp, source count and uncertainty always travel with the claim — an
 * answer whose caveats live elsewhere is an answer without caveats.
 */
export function describeAssessment(a: Assessment): string {
  const parts: string[] = [];

  switch (a.confidence) {
    case "well_supported":
      parts.push(`Confirmed by ${a.independentSupport} independent sources.`);
      break;
    case "supported":
      parts.push(`Supported by ${a.independentSupport} independent sources, with caveats.`);
      break;
    case "single_source":
      parts.push("Reported by one source only — unconfirmed.");
      break;
    case "contested":
      parts.push("Sources disagree.");
      break;
    case "unsupported":
      parts.push("Not supported by anything OCADE could find.");
      break;
  }

  if (a.asOf) parts.push(`Most recent source dated ${a.asOf}.`);
  for (const u of a.uncertainties) parts.push(u);

  return parts.join(" ");
}
