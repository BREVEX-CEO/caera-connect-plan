/**
 * HOW SURE OCADE HAS TO BE THAT IT IS STILL YOU.
 *
 * Two different questions get confused constantly, and this module keeps them
 * apart because the answers differ:
 *
 *   ASSURANCE — how strongly was this session authenticated? Supabase calls
 *   this the Authenticator Assurance Level. `aal1` is one factor; `aal2` means
 *   a second factor was verified for THIS session.
 *
 *   RECENCY — how long ago? A session that reached `aal2` this morning and has
 *   been sitting on an unlocked laptop since lunch is fully assured and not
 *   recent, and "assured" alone is what lets a passer-by delete an account.
 *
 * A high-risk action needs both, and neither implies the other.
 *
 * WHY THIS IS PURE. Every rule below is a function of four values — what the
 * action needs, what the session has, whether the account has a factor at all,
 * and when it last proved itself. No Supabase client, no clock, no storage. The
 * decision is the part that must be right, and it is reachable from a test
 * without a database or a browser.
 *
 * THE RULE THAT KEEPS PEOPLE OUT OF THEIR OWN ACCOUNTS, and why it is written
 * the way PLAN.md asks: AAL2 is enforced FOR ENROLLED USERS. An account with no
 * second factor cannot reach `aal2` by any means, so demanding it there would
 * not be strict — it would be a permanent refusal, and the only way out would
 * be to weaken the rule later under pressure. An account with no factor is held
 * to recency instead, and told that enrolling raises the bar.
 */

export type AssuranceLevel = "aal1" | "aal2";

/**
 * How long a proof of identity counts as recent.
 *
 * Ten minutes is chosen against the thing being defended: somebody with
 * physical access to an unlocked, signed-in browser. It is long enough to
 * change a password and then change a billing detail without re-proving, and
 * short enough that a laptop left open at a cafe is not an account takeover.
 *
 * Not configurable per deployment. A security window that can be widened from
 * the outside is a security window that will be.
 */
export const RECENT_PROOF_MS = 10 * 60 * 1000;

/** What every high-risk action demands: the second factor where there is one, and a recent proof. */
export const HIGH_RISK_REQUIREMENT: AssuranceRequirement = { level: "aal2" };

/**
 * What an action demands.
 *
 * `reauthWithinMs` is deliberately optional and defaults to the constant above
 * rather than to "no requirement" — an action that declares an assurance level
 * and forgets the window gets the strict answer, not the lenient one.
 */
export interface AssuranceRequirement {
  level: AssuranceLevel;
  reauthWithinMs?: number;
}

/** What the current session can actually show for itself. */
export interface SessionAssurance {
  /** The level Supabase reports for this session. */
  current: AssuranceLevel;
  /**
   * Whether the account has a VERIFIED second factor.
   *
   * An enrollment that was started and never verified does not count: it can
   * be abandoned at will, so treating it as enrolled would let somebody lower
   * their own bar by beginning a setup they never finish.
   */
  hasVerifiedFactor: boolean;
  /**
   * When this session last proved who it was, as epoch milliseconds.
   *
   * Read from the token's authentication-methods list rather than from when the
   * session was created: signing in again, or completing a factor challenge,
   * both refresh it, and both are genuine fresh proof.
   *
   * `null` means OCADE could not establish it, which is NOT treated as recent.
   */
  lastAuthenticatedAt: number | null;
}

export type AssuranceRefusal =
  /** The account has a factor, this session has not used it. */
  | "factor_required"
  /** Assurance is fine; the proof is too old. */
  | "reauthentication_required";

export type AssuranceDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: AssuranceRefusal;
      /** Shown to the person. Says what to do, not what failed. */
      message: string;
      /** True when enrolling a factor would raise this account's own bar. */
      enrollmentWouldHelp: boolean;
    };

/**
 * May this session take this action?
 *
 * ORDER MATTERS. The factor check comes first: telling somebody to
 * re-authenticate when what they actually need is to complete a second-factor
 * challenge sends them round a loop that never ends, because signing in again
 * produces another `aal1` session.
 */
export function decideAssurance(input: {
  requires: AssuranceRequirement;
  session: SessionAssurance;
  now: number;
}): AssuranceDecision {
  const { requires, session, now } = input;

  if (requires.level === "aal2" && session.hasVerifiedFactor && session.current !== "aal2") {
    return {
      allowed: false,
      reason: "factor_required",
      message:
        "Confirm the code from your authenticator app before making this change. It only takes a moment and it stops somebody who finds this browser open from doing it instead.",
      enrollmentWouldHelp: false,
    };
  }

  const within = requires.reauthWithinMs ?? RECENT_PROOF_MS;
  const provedAt = session.lastAuthenticatedAt;
  /*
   * An unknown proof time fails CLOSED. It happens when a token arrives without
   * an authentication-methods list, and the safe reading of "OCADE cannot tell
   * when you last proved this" is not "recently".
   */
  const recent = provedAt !== null && now - provedAt <= within && now >= provedAt;
  if (!recent) {
    return {
      allowed: false,
      reason: "reauthentication_required",
      message:
        "Confirm it is you before making this change. This is asked for anything that could lock you out or cost you money, however long you have been signed in.",
      /*
       * Said only where it is TRUE. Suggesting enrollment to somebody who has
       * already enrolled reads as the product not knowing its own state, and
       * suggesting it as the fix for a stale proof would be wrong advice: a
       * second factor does not make an old proof recent.
       */
      enrollmentWouldHelp: requires.level === "aal2" && !session.hasVerifiedFactor,
    };
  }

  return { allowed: true };
}

/**
 * Read the assurance facts out of a decoded Supabase access token.
 *
 * KEPT SEPARATE FROM THE DECISION so the rule above never has to know the shape
 * of a token, and so this — which is only reading — can be checked against real
 * claim shapes without constructing a policy.
 *
 * `amr` is the authentication-methods list Supabase puts in the token: one
 * entry per proof, each with the method used and when. The LATEST of them is
 * the last time this session proved anything, which is what recency means.
 */
export function assuranceFromClaims(
  claims: Record<string, unknown> | null | undefined,
  hasVerifiedFactor: boolean,
): SessionAssurance {
  const aal = claims?.["aal"];
  const current: AssuranceLevel = aal === "aal2" ? "aal2" : "aal1";

  let lastAuthenticatedAt: number | null = null;
  const amr = claims?.["amr"];
  if (Array.isArray(amr)) {
    for (const entry of amr) {
      const timestamp = (entry as { timestamp?: unknown } | null)?.timestamp;
      // Supabase reports these in SECONDS. Reading them as milliseconds would
      // place every proof in 1970 and make nothing ever recent.
      if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
        const millis = timestamp * 1000;
        if (lastAuthenticatedAt === null || millis > lastAuthenticatedAt) {
          lastAuthenticatedAt = millis;
        }
      }
    }
  }

  return { current, hasVerifiedFactor, lastAuthenticatedAt };
}
