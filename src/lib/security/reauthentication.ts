/**
 * PROVING, RIGHT NOW, THAT IT IS STILL YOU.
 *
 * `assurance.ts` decides WHETHER a session is fresh and strong enough. This is
 * the other half: reading what the live session can show for itself, and — when
 * it cannot show enough — the one mechanism OCADE has for making it fresh
 * again.
 *
 * WHY IT IS ONE MODULE INSTEAD OF THREE COPIES. The password-proof was written
 * out twice, in `SignInMethodsPanel` and on the security settings page, and the
 * two copies had already diverged on the question that matters: one of them
 * treated a session at `aal2` as proof and skipped the password entirely. That
 * is exactly the case `assurance.ts` documents as the reason recency exists —
 * "a session that reached aal2 this morning and has been sitting on an unlocked
 * laptop since lunch is fully assured and not recent" — so the shortcut let a
 * passer-by change how somebody signs in. A third copy was about to be written
 * for the organization screen, which is when a duplicated rule stops being
 * untidy and starts being a vulnerability.
 *
 * WHAT THIS IS NOT. It is not authorization. The database refuses these actions
 * on its own — `ocade_require_recent_strong_auth` runs inside the mutations
 * themselves, where the grant is — and Supabase refuses the identity calls on
 * its own. This exists so a person is asked BEFORE they press something, and so
 * the refusal that comes back can be turned into the right next step rather
 * than an apology.
 *
 * THE TWO DOORS ARE DIFFERENT. Somebody who needs to answer an authenticator
 * code and is shown a password box will type a password, be told it is not
 * enough, and have learned nothing. `nextStepFor` keeps them apart.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import {
  assuranceFromClaims,
  decideAssurance,
  type AssuranceDecision,
  type AssuranceRefusal,
  type AssuranceRequirement,
  type SessionAssurance,
} from "./assurance";

/**
 * What the current session can show for itself.
 *
 * `getClaims` rather than a hand-rolled base64 split: it verifies the token
 * against the project's signing key, so a claim set that has been tampered with
 * in storage does not become an answer. The `amr` list and the `aal` claim both
 * come from there, and `listFactors` answers the one question the token cannot
 * — whether this ACCOUNT has a verified factor at all.
 */
export async function readSessionAssurance(override?: unknown): Promise<SessionAssurance> {
  const supabase = (override ?? (await loadSupabaseClient())) as Awaited<
    ReturnType<typeof loadSupabaseClient>
  >;

  let claims: Record<string, unknown> | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    claims = (data?.claims ?? null) as Record<string, unknown> | null;
  } catch {
    /*
     * Left null, which `assuranceFromClaims` turns into an unknown proof time
     * and `decideAssurance` treats as NOT recent. A session OCADE cannot read
     * is a session it should ask about, not one it should wave through.
     */
  }

  let hasVerifiedFactor = false;
  try {
    const { data } = await supabase.auth.mfa.listFactors();
    hasVerifiedFactor = (data?.all ?? []).some((factor) => factor.status === "verified");
  } catch {
    /*
     * Lenient on the factor question and strict on recency, the same way round
     * as the server middleware: treating an unreadable factor list as
     * "enrolled" would demand a challenge the person may be unable to answer.
     */
  }

  return assuranceFromClaims(claims, hasVerifiedFactor);
}

/** Would this session be refused, and why? Asked before a control is offered. */
export async function checkAssurance(
  requires: AssuranceRequirement,
  override?: unknown,
): Promise<AssuranceDecision> {
  const session = await readSessionAssurance(override);
  return decideAssurance({ requires, session, now: Date.now() });
}

export type ProofOutcome =
  | { proved: true }
  /** OCADE does not know this account's address, so it cannot check a password. */
  | { proved: false; reason: "no_email" }
  /** The password did not match. */
  | { proved: false; reason: "wrong_password" };

/**
 * Prove identity with the account's current password.
 *
 * Supabase has no "reauthenticate" call, so the check is a sign-in against the
 * current password: it succeeds only for somebody who knows it, and it
 * REFRESHES THE SAME SESSION rather than starting a new one — so nothing about
 * the open page changes when it passes, and the token comes back carrying a
 * fresh entry in its authentication-methods list, which is precisely what makes
 * the next action recent enough.
 *
 * The caller supplies the address and the prose. Both existing call sites had
 * their own wording, correctly: on the password screen the way out is the
 * emailed reset link, and on the sign-in-methods panel it is setting a password
 * first. Only the mechanism is shared.
 */
export async function proveIdentityWithPassword(
  email: string | null | undefined,
  password: string,
  override?: unknown,
): Promise<ProofOutcome> {
  if (!email) return { proved: false, reason: "no_email" };
  const supabase = (override ?? (await loadSupabaseClient())) as Awaited<
    ReturnType<typeof loadSupabaseClient>
  >;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { proved: false, reason: "wrong_password" } : { proved: true };
}

/**
 * The refusal a Supabase RPC sends back when the database declined.
 *
 * `ocade_require_recent_strong_auth` raises with PostgREST's `PT403`, so the
 * request fails with a 403 rather than a 500, and puts a stable token in
 * DETAIL. supabase-js surfaces that as `details`. Reading the token rather than
 * matching on the sentence means the prose can be improved without silently
 * turning a prompt back into an apology.
 */
export function assuranceRefusalOf(error: unknown): AssuranceRefusal | null {
  if (!error || typeof error !== "object") return null;
  const details = (error as { details?: unknown }).details;
  if (details === "factor_required" || details === "reauthentication_required") return details;
  return null;
}
