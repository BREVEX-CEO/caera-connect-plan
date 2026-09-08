/**
 * THE ONE PLACE OCADE TALKS TO SUPABASE ABOUT SECOND FACTORS.
 *
 * Supabase Auth is the login authority and stays the login authority: this
 * wraps `supabase.auth.mfa.*` and adds no second store of factors, no parallel
 * verification, and no separate notion of who is signed in. PLAN.md §B is
 * explicit — complete MFA through the existing authority, do not build another
 * login system — and the reason is that two systems that both believe they know
 * whether you are authenticated will eventually disagree.
 *
 * WHAT THIS FILE IS FOR, then, is the part Supabase deliberately leaves to the
 * application:
 *
 *   - turning its errors into sentences a person can act on;
 *   - knowing which factors are VERIFIED rather than merely started;
 *   - reporting assurance in the shape `assurance.ts` decides on.
 *
 * UNVERIFIED FACTORS ARE NOT FACTORS. Enrollment creates a factor immediately
 * and it stays `unverified` until a code is entered. Counting those would let
 * somebody lower their own bar by starting a setup they never finish — and
 * would show "protected" on an account that is not — so every reader here
 * filters on `verified`, and the abandoned ones are cleaned up rather than left
 * to accumulate.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import type { AssuranceLevel } from "./assurance";

/** A second factor as the product talks about it. */
export interface SecondFactor {
  id: string;
  /** What the person called it: "iPhone", "work laptop". */
  name: string;
  verified: boolean;
  createdAt: string | null;
}

export interface EnrollmentStarted {
  factorId: string;
  /** `otpauth://` URI for the QR code. */
  uri: string;
  /** The same secret, for typing in by hand when a camera is not an option. */
  secret: string;
}

type Client = SupabaseClient<never, never, never>;

/**
 * The client every call here goes through — loaded on demand.
 *
 * ASYNC BECAUSE THE IMPORT IS. This module is reached from the challenge route,
 * which the generated route tree imports statically, so a top-level import put
 * the 203 KiB Supabase client on the entry chunk's graph for a screen that only
 * appears to somebody who has enrolled a second factor.
 *
 * `override` still short-circuits it, so tests inject a client without touching
 * the network or the module at all.
 */
async function client(override?: unknown): Promise<Client> {
  if (override) return override as Client;
  return (await loadSupabaseClient()) as unknown as Client;
}

/**
 * Say what went wrong in words the person can act on.
 *
 * Supabase's messages are accurate and written for developers — "invalid TOTP
 * code entered", "mfa factor verification failed". Somebody standing there with
 * a phone needs to know whether to retype the code, wait for the next one, or
 * start again, and each of those is a different sentence.
 *
 * WHAT IT NEVER DOES is invent a reason. Anything unrecognised is passed
 * through rather than replaced with a comforting guess, because a wrong
 * explanation costs more than an unfamiliar one.
 */
export function describeMfaError(error: { message?: string; code?: string } | null): string {
  const raw = error?.message ?? "";
  const code = error?.code ?? "";

  if (/invalid.*(totp|code)|code.*invalid/i.test(raw) || code === "mfa_verification_failed") {
    return "That code was not accepted. Codes change every thirty seconds — wait for the next one and enter it as soon as it appears.";
  }
  if (/expired|challenge.*not.*found/i.test(raw) || code === "mfa_challenge_expired") {
    return "That code took too long to arrive. Ask for a new one and enter the next code your app shows.";
  }
  if (/rate.?limit|too many/i.test(raw) || code === "over_request_rate_limit") {
    return "Too many attempts just now. Wait a minute before trying again — this limit is what stops somebody guessing their way in.";
  }
  if (/already.*enrolled|factor.*exists|friendly.?name/i.test(raw)) {
    return "There is already a factor with that name on this account. Give this one a different name so you can tell them apart later.";
  }
  if (/aal2|assurance/i.test(raw) || code === "insufficient_aal") {
    return "Confirm the code from your authenticator app before making this change.";
  }
  return raw || "That did not work. Try again in a moment.";
}

/** Every factor on the account, verified or not. */
export async function listFactors(override?: unknown): Promise<SecondFactor[]> {
  const { data, error } = await (await client(override)).auth.mfa.listFactors();
  if (error) throw new Error(describeMfaError(error));
  /*
   * `data.totp` is Supabase's already-filtered list of VERIFIED totp factors,
   * and `data.all` is everything. Reading `all` and filtering here means the
   * unverified ones are visible to the cleanup path rather than invisible
   * everywhere, which is what let them accumulate.
   */
  const all = data?.all ?? [];
  return all.map((factor) => ({
    id: factor.id,
    name: factor.friendly_name ?? "Authenticator app",
    verified: factor.status === "verified",
    createdAt: factor.created_at ?? null,
  }));
}

/** Only the factors that actually protect the account. */
export async function listVerifiedFactors(override?: unknown): Promise<SecondFactor[]> {
  return (await listFactors(override)).filter((factor) => factor.verified);
}

/**
 * What Supabase says this session's assurance is.
 *
 * THE ACCESS TOKEN IS PASSED DELIBERATELY, and it is the difference between
 * this working and this being decorative.
 *
 * Called with no argument, `getAuthenticatorAssuranceLevel` reads
 * `session.user.factors` out of the STORED session — the copy written to
 * localStorage when this browser last signed in. `getUser()` refreshes over the
 * network but does not write the user back into that stored session, so the
 * factor list there is frozen at sign-in.
 *
 * The consequence, found by driving the real journey in a browser rather than
 * by reading this code: enroll on a laptop and every other device keeps
 * reporting "no second factor" until its session happens to refresh. The gate
 * never fires there, and MFA becomes an ornament on every device except the one
 * that set it up.
 *
 * Passing the token makes the library fetch the user fresh, so the answer
 * reflects the account rather than this browser's memory of it.
 */
export async function currentAssurance(
  override?: unknown,
): Promise<{ current: AssuranceLevel; next: AssuranceLevel }> {
  const supabaseClient = await client(override);
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData?.session?.access_token;

  const { data, error } = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel(
    token ?? undefined,
  );
  if (error) throw new Error(describeMfaError(error));
  return {
    current: data?.currentLevel === "aal2" ? "aal2" : "aal1",
    /*
     * `nextLevel` is what this session COULD reach. When it is aal2 and the
     * current level is not, there is a challenge outstanding — that difference
     * is what tells the app to show the code prompt rather than the enrollment
     * screen.
     */
    next: data?.nextLevel === "aal2" ? "aal2" : "aal1",
  };
}

/**
 * Begin enrolling an authenticator app.
 *
 * The factor exists after this call and does NOT protect anything until
 * `verifyEnrollment` succeeds. That gap is deliberate on Supabase's part and
 * correct: a factor that started protecting the account before the person
 * proved their app could produce a code would lock out anybody whose camera
 * failed halfway through.
 */
export async function startEnrollment(
  friendlyName: string,
  override?: unknown,
): Promise<EnrollmentStarted> {
  const name = friendlyName.trim();
  if (!name) throw new Error("Give this device a name, so you can tell it from the next one.");
  if (name.length > 60) throw new Error("That name is too long. Thirty characters is plenty.");

  const { data, error } = await (
    await client(override)
  ).auth.mfa.enroll({
    factorType: "totp",
    friendlyName: name,
  });
  if (error) throw new Error(describeMfaError(error));
  if (!data?.totp?.uri || !data.totp.secret) {
    throw new Error("OCADE could not start the setup. Try again in a moment.");
  }
  return { factorId: data.id, uri: data.totp.uri, secret: data.totp.secret };
}

/**
 * Finish enrollment by proving the app produces the right code.
 *
 * Challenge then verify, as Supabase requires. On success the session is raised
 * to aal2 — the person who just proved possession should not then be asked to
 * prove it again to use what they set up.
 */
export async function verifyEnrollment(
  factorId: string,
  code: string,
  override?: unknown,
): Promise<void> {
  const supabaseClient = await client(override);
  const { data: challenge, error: challengeError } = await supabaseClient.auth.mfa.challenge({
    factorId,
  });
  if (challengeError) throw new Error(describeMfaError(challengeError));

  const { error } = await supabaseClient.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.replace(/\s/g, ""),
  });
  if (error) throw new Error(describeMfaError(error));
}

/**
 * Answer a login challenge for an already-enrolled factor.
 *
 * Same two calls; separate function because the two moments are different to
 * the person — one is "set this up", the other is "you are already set up, prove
 * it" — and merging them produced a single screen that had to guess which it
 * was showing.
 */
export async function answerChallenge(
  factorId: string,
  code: string,
  override?: unknown,
): Promise<void> {
  return verifyEnrollment(factorId, code, override);
}

/**
 * Remove a factor.
 *
 * NO ASSURANCE CHECK HERE, deliberately. Supabase requires aal2 for this call
 * and refuses it otherwise, and OCADE's own `decideAssurance` gate runs at the
 * surface. A third check in the middle would be a third place to get it wrong,
 * and the one that matters is the server's.
 */
export async function removeFactor(factorId: string, override?: unknown): Promise<void> {
  const { error } = await (await client(override)).auth.mfa.unenroll({ factorId });
  if (error) throw new Error(describeMfaError(error));
}

/**
 * Discard enrollments that were started and never finished.
 *
 * Every abandoned QR screen leaves a factor behind. They protect nothing, they
 * accumulate, and Supabase counts them against the account's factor limit — so
 * somebody who tried three times and got interrupted can find they are unable
 * to enroll at all, with nothing on screen explaining why.
 *
 * Best-effort by design: this tidies up, and a failure to tidy must never be
 * what stops somebody enrolling.
 */
export async function discardUnverifiedFactors(override?: unknown): Promise<number> {
  let removed = 0;
  for (const factor of await listFactors(override)) {
    if (factor.verified) continue;
    try {
      await removeFactor(factor.id, override);
      removed += 1;
    } catch {
      /* Tidying is not the task the person asked for. */
    }
  }
  return removed;
}
