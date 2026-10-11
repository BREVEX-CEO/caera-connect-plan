/**
 * AAL ENFORCEMENT WHERE IT COUNTS: ON THE SERVER.
 *
 * Supabase's own guidance is explicit that the application must enforce
 * assurance in the UI, the APIs and the database — not merely render a setup
 * screen. A screen that hides a button is a screen; the request behind it is
 * still there, and anybody can send it.
 *
 * So this is the API half. It composes onto `requireSupabaseAuth` rather than
 * replacing it, because there is one authentication authority and this only
 * adds a question on top of it: is this session assured enough, and recently
 * enough, for what it is about to do?
 *
 * THE FACTS COME FROM THE TOKEN AND FROM SUPABASE, NEVER FROM THE CALLER.
 * `aal` and the authentication-methods list are claims inside a signed token
 * the browser cannot alter, and whether a VERIFIED factor exists is read from
 * Supabase. A request that could assert its own assurance would be a request
 * that could assert anything.
 *
 * THE DECISION ITSELF IS NOT HERE. It lives in `assurance.ts`, pure and
 * exhaustively tested. This middleware gathers the facts and reports the
 * refusal; keeping the rule out of the request path is what lets every branch
 * of it be checked without a server.
 */
import { createMiddleware } from "@tanstack/react-start";
import { requireSession } from "@/lib/security/session-middleware";
import {
  assuranceFromClaims,
  decideAssurance,
  HIGH_RISK_REQUIREMENT,
  type AssuranceRequirement,
  type SessionAssurance,
} from "./assurance";

/**
 * Thrown when a session is not assured enough for what it asked to do.
 *
 * A named class so a surface can tell "you need to confirm the code" apart from
 * "that went wrong", and prompt rather than apologise.
 */
class AssuranceRequiredError extends Error {
  constructor(
    readonly reason: "factor_required" | "reauthentication_required",
    message: string,
    readonly enrollmentWouldHelp: boolean,
  ) {
    super(message);
    this.name = "AssuranceRequiredError";
  }
}

/** Facts about the caller's session, gathered from sources it does not control. */
async function readSessionAssurance(context: {
  supabase: { auth: { mfa: { listFactors: () => Promise<{ data: unknown; error: unknown }> } } };
  claims: Record<string, unknown> | null | undefined;
}): Promise<SessionAssurance> {
  let hasVerifiedFactor = false;
  try {
    const { data } = await context.supabase.auth.mfa.listFactors();
    const all = (data as { all?: { status?: string }[] } | null)?.all ?? [];
    hasVerifiedFactor = all.some((factor) => factor.status === "verified");
  } catch {
    /*
     * A failed factor read leaves `hasVerifiedFactor` false, which makes the
     * rule LENIENT on the factor question and strict on recency — and that is
     * the right way round. Treating an unreadable factor list as "enrolled"
     * would demand a challenge the person may be unable to answer, locking them
     * out of their own account because of an outage.
     */
  }
  return assuranceFromClaims(context.claims, hasVerifiedFactor);
}

/**
 * Require a level of assurance for a server function.
 *
 * Used as `.middleware([requireAssurance({ level: "aal2" })])`, which reads at
 * the call site as the sentence it is.
 */
export function requireAssurance(
  requires: AssuranceRequirement,
  /**
   * Also allow a session whose every factor is newer than it: two-step was set
   * up in this very sign-in, so no older factor is being got round (the
   * recovery codes made the moment two-step is turned on).
   */
  options: { firstSetup?: boolean } = {},
) {
  return createMiddleware({ type: "function" })
    .middleware([requireSession])
    .server(async ({ next, context, data, serverFnMeta }) => {
      const session = await readSessionAssurance(
        context as unknown as Parameters<typeof readSessionAssurance>[0],
      );
      const decision = decideAssurance({ requires, session, now: Date.now() });
      if (!decision.allowed) {
        throw new AssuranceRequiredError(
          decision.reason,
          decision.message,
          decision.enrollmentWouldHelp,
        );
      }
      /*
       * A factor added after this session signed in proves nothing yet: a
       * stolen token could enroll its own and answer it. The database rule
       * (20261001095000), asked here for the actions only the server performs.
       * Every requirement carries recency (decideAssurance), so every one asks.
       */
      const { supabase } = context as unknown as {
        supabase: {
          rpc: (
            fn:
              | "ocade_factor_added_since_sign_in"
              | "ocade_two_step_set_up_in_this_sign_in"
              | "ocade_spend_proof",
            args?: Record<string, string>,
          ) => PromiseLike<{ data: unknown; error: unknown }>;
        };
      };
      const { data: newer, error } = await supabase.rpc("ocade_factor_added_since_sign_in");
      if (error) throw new Error("OCADE could not check this session just now. Try again.");
      const firstSetup =
        newer === true &&
        options.firstSetup === true &&
        (await supabase.rpc("ocade_two_step_set_up_in_this_sign_in")).data === true;
      if (newer === true && !firstSetup) {
        throw new AssuranceRequiredError(
          "reauthentication_required",
          "You set up two-step verification after signing in here. Sign in again, then try this.",
          false,
        );
      }
      /*
       * ONE PROOF, ONE ACTION. The proof is spent on this action and a digest of
       * what it acts on; a second sensitive action with the same proof asks again,
       * so a token taken right after a confirmation cannot do a string of them.
       */
      const digest = new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(data ?? null)),
        ),
      );
      const { data: spent, error: spendError } = await supabase.rpc("ocade_spend_proof", {
        p_action: (serverFnMeta?.name || "sensitive action").slice(0, 120),
        p_target_digest: Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(""),
      });
      if (spendError) throw new Error("OCADE could not check this session just now. Try again.");
      if (spent !== true) {
        throw new AssuranceRequiredError(
          "reauthentication_required",
          "Confirm it is you again: each confirmation covers one change.",
          false,
        );
      }
      return next({ context: { assurance: session } });
    });
}

/**
 * The requirement OCADE puts on its highest-risk actions.
 *
 * ONE CONSTANT, named, so that "high risk" means the same thing at every call
 * site. PLAN.md §B lists what belongs here: security settings, billing,
 * ownership, organization deletion, connector administration. A second literal
 * `{ level: "aal2" }` somewhere else is how one of them quietly ends up with a
 * different rule.
 */
export const HIGH_RISK: AssuranceRequirement = HIGH_RISK_REQUIREMENT;
