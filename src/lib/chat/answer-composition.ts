/**
 * OCADE answer composition (master plan §4.3).
 *
 * An answer that blends what OCADE observed, what it looked up, what it guessed,
 * and what it recommends into one confident paragraph is the quiet root of
 * being misled. The reader can't tell the load-bearing fact from the hunch.
 *
 * So a composed answer is a list of typed claims, each tagged with its
 * epistemic status, and this module enforces the rules that keep those tags
 * honest:
 *
 *  - A **retrieved fact** must cite a source. A fact with no source isn't a
 *    fact OCADE retrieved — it's an inference wearing a fact's clothes, and it
 *    is rejected as mislabelled.
 *  - A **time-sensitive** claim must carry a freshness timestamp, because "the
 *    price is X" without "as of when" is a claim that quietly rots.
 *  - An **inference** or **hypothesis** may never be presented as observation
 *    or fact; the whole point of the tags is that they don't collapse into each
 *    other.
 *  - A **recommendation** or **action** is separated from the reasoning behind
 *    it, so the reader sees what OCADE suggests distinctly from why.
 *
 * Pure. It shapes and checks an answer; it does not generate prose.
 */

export type ClaimKind =
  /** Something OCADE directly saw (a screen, a file, a returned value). */
  | "observation"
  /** A fact retrieved from a source, which must be cited. */
  | "retrieved_fact"
  /** A conclusion OCADE drew from observations/facts. */
  | "inference"
  /** A possibility OCADE is entertaining, not asserting. */
  | "hypothesis"
  /** What OCADE suggests the user do. */
  | "recommendation"
  /** An action OCADE took or proposes to take. */
  | "action";

export interface Claim {
  kind: ClaimKind;
  text: string;
  /** Required for retrieved_fact: where it came from. */
  source?: string;
  /** ISO timestamp; required when `timeSensitive` is true. */
  asOf?: string;
  /** True when the claim's truth depends on when it's read. */
  timeSensitive?: boolean;
}

export type ComposeOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

const KIND_LABEL: Record<ClaimKind, string> = {
  observation: "Observed",
  retrieved_fact: "Fact",
  inference: "Inference",
  hypothesis: "Possibility",
  recommendation: "Suggestion",
  action: "Action",
};

/**
 * Validate a single claim against the labelling rules.
 *
 * Returns the specific reason it's mislabelled, so the caller (or a test) sees
 * exactly which honesty rule would have been broken.
 */
export function validateClaim(claim: Claim): ComposeOutcome<Claim> {
  if (!claim.text.trim()) return { ok: false, reason: "A claim can't be empty." };

  if (claim.kind === "retrieved_fact" && !claim.source?.trim()) {
    return {
      ok: false,
      reason: `“${truncate(claim.text)}” is tagged as a retrieved fact but cites no source. A fact with no source is an inference in disguise — tag it as an inference or add the source.`,
    };
  }

  if (claim.timeSensitive && !claim.asOf?.trim()) {
    return {
      ok: false,
      reason: `“${truncate(claim.text)}” is time-sensitive but has no timestamp. "As of when" is part of the claim — without it, it quietly goes stale.`,
    };
  }

  if (claim.asOf && Number.isNaN(Date.parse(claim.asOf))) {
    return { ok: false, reason: `“${truncate(claim.text)}” has an unreadable timestamp.` };
  }

  // A source on a non-fact is suspicious: observations and inferences are
  // OCADE's own, not something it "retrieved". Allowed but normalised away for
  // recommendations/actions where a citation would imply borrowed authority.
  return { ok: true, data: claim, evidence: `${KIND_LABEL[claim.kind]} claim is well-formed.` };
}

export interface ComposedAnswer {
  claims: Claim[];
  /** Counts by kind, so the shape of the answer is visible at a glance. */
  breakdown: Record<ClaimKind, number>;
  /** True when the answer rests on at least one cited fact or observation. */
  grounded: boolean;
  /** Claims whose truth depends on time, with their timestamps. */
  timeSensitive: Claim[];
}

/**
 * Compose and validate a full answer.
 *
 * Rejects the whole answer if any claim is mislabelled — a single fact-shaped
 * inference is enough to mislead, so it isn't quietly downgraded and shown
 * anyway.
 */
export function composeAnswer(claims: Claim[]): ComposeOutcome<ComposedAnswer> {
  if (claims.length === 0) return { ok: false, reason: "There are no claims to compose." };

  for (const claim of claims) {
    const check = validateClaim(claim);
    if (!check.ok) return check;
  }

  const breakdown: Record<ClaimKind, number> = {
    observation: 0,
    retrieved_fact: 0,
    inference: 0,
    hypothesis: 0,
    recommendation: 0,
    action: 0,
  };
  for (const c of claims) breakdown[c.kind]++;

  const grounded = breakdown.observation > 0 || breakdown.retrieved_fact > 0;
  const timeSensitive = claims.filter((c) => c.timeSensitive);

  // A recommendation resting on nothing observed or retrieved is just an
  // opinion; the answer is allowed, but this is surfaced rather than hidden.
  const recommendsWithoutGround =
    (breakdown.recommendation > 0 || breakdown.action > 0) && !grounded;

  return {
    ok: true,
    data: { claims, breakdown, grounded, timeSensitive },
    evidence: recommendsWithoutGround
      ? `${claims.length} claims, but nothing observed or cited underneath the recommendation — it rests on reasoning alone.`
      : `${claims.length} claims: ${describeBreakdown(breakdown)}.`,
  };
}

function describeBreakdown(b: Record<ClaimKind, number>): string {
  return (Object.entries(b) as [ClaimKind, number][])
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${KIND_LABEL[k].toLowerCase()}`)
    .join(", ");
}

/**
 * Render an answer with its claims visibly separated by kind.
 *
 * The prefixes are the point: a reader scanning the answer sees "Inference:"
 * and "Fact:" as distinct, and never mistakes one for the other.
 */
export function renderAnswer(answer: ComposedAnswer): string {
  return answer.claims
    .map((c) => {
      const stamp = c.asOf ? ` (as of ${c.asOf})` : "";
      const cite = c.kind === "retrieved_fact" && c.source ? ` [${c.source}]` : "";
      return `${KIND_LABEL[c.kind]}: ${c.text}${stamp}${cite}`;
    })
    .join("\n");
}

function truncate(s: string): string {
  return s.length > 48 ? `${s.slice(0, 48)}…` : s;
}
