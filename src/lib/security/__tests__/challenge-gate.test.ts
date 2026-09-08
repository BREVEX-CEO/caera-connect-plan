import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * MFA THAT IS NEVER ASKED FOR IS AN ORNAMENT.
 *
 * The enrollment screen, the factor list and the recovery codes can all be
 * perfect while a stolen password still reaches every screen in the product —
 * because nothing ever raises a session from `aal1` to `aal2`. That gap is
 * invisible: Settings says "On", the factor genuinely exists, and the account
 * is no better protected than before.
 *
 * PLAN.md §B calls for a "login challenge before protected application
 * access". This asserts the gate exists in the layout every authenticated
 * route inherits, and — more importantly — the four properties that decide
 * whether it is safe rather than merely present.
 *
 * Read from source because the property is structural: a route guard's
 * ordering, and what it does when a network call fails, cannot be observed by
 * rendering a component.
 */
const GUARD = readFileSync("src/routes/_authenticated/route.tsx", "utf8");
const CHALLENGE = readFileSync("src/routes/_authenticated/challenge.tsx", "utf8");

describe("the second factor is actually demanded", () => {
  it("asks for assurance in the layout every authenticated route inherits", () => {
    expect(GUARD).toContain("currentAssurance()");
    expect(GUARD).toMatch(/to:\s*"\/challenge"/);
  });

  it("goes through the shared authority rather than the library directly", () => {
    /*
     * `currentAssurance` passes the access token so factors are read from the
     * ACCOUNT. Calling `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`
     * here instead would read this browser's stored session — frozen at
     * sign-in — and the gate would never fire on any device except the one
     * that enrolled. That is the bug a browser run found; this keeps it fixed.
     */
    expect(GUARD).not.toContain("auth.mfa.getAuthenticatorAssuranceLevel");
  });

  it("redirects only when a challenge is genuinely available", () => {
    /*
     * `nextLevel === "aal2"` is Supabase's way of saying this session COULD
     * complete a challenge — which is true exactly when a verified factor
     * exists. Redirecting without that check would trap every account without
     * a factor at a prompt it has no way to answer.
     */
    expect(GUARD).toMatch(/level\.next === "aal2"/);
    expect(GUARD).toMatch(/level\.current !== "aal2"/);
  });

  it("does not redirect the challenge screen to itself", () => {
    // Without the exemption the gate is an infinite loop: every load of
    // /challenge is an aal1 session on an enrolled account.
    expect(GUARD).toMatch(/pathname\.startsWith\("\/challenge"\)/);
  });

  it("skips the check offline rather than locking a local-first product", () => {
    /*
     * The assurance call is a network read. The same reasoning as the
     * onboarding gate below it: somebody whose wifi dropped must not be held
     * at a prompt, and the cached session was already checked for expiry and
     * rejection further up.
     */
    const gate = GUARD.slice(GUARD.indexOf("SECOND-FACTOR GATE"));
    expect(gate.slice(0, 2500)).toMatch(/!offline/);
  });

  it("lets the redirect out of the catch that swallows read failures", () => {
    /*
     * THE BUG THIS SHAPE INVITES. TanStack signals a redirect by THROWING it,
     * and the try/catch here exists to fail open on an unreadable assurance
     * answer. A bare `catch {}` would therefore swallow the redirect itself
     * and the gate would silently never fire — passing every other assertion
     * in this file.
     */
    const gate = GUARD.slice(GUARD.indexOf("SECOND-FACTOR GATE"));
    const block = gate.slice(0, gate.indexOf("Onboarding gate"));

    /*
     * `isRedirect`, the library's own predicate — NOT a hand-rolled shape
     * check. This assertion originally read `/"to" in error/` and matched the
     * guard, which also read `"to" in error`. Both were wrong in the same way:
     * a thrown redirect is a `Response` whose navigation options live under
     * `.options`, with no `to` at the top level. So the guard swallowed every
     * redirect, an enrolled account walked straight into the product, and this
     * test passed the whole time. A browser run is what found it.
     *
     * Asserting the library's predicate is what makes the test independent of
     * the mistake rather than a copy of it.
     */
    expect(block).toMatch(/isRedirect\(error\)\)?\s*throw error/);
    expect(GUARD).toMatch(/isRedirect/);
  });
});

describe("the way out for somebody who lost their phone", () => {
  it("is offered on the challenge screen itself", () => {
    /*
     * This is exactly where that person is standing. Sending them to a support
     * route that would itself require the sign-in they cannot finish is the
     * loop that makes people abandon accounts.
     */
    expect(CHALLENGE).toContain("I have lost my phone");
    expect(CHALLENGE).toContain("redeemRecoveryCode");
  });

  it("signs out rather than letting a code through the challenge", () => {
    /*
     * A recovery code REMOVES the factor and revokes every session. If it let
     * somebody straight in, a stolen sheet of paper would be a password —
     * which is the whole reason OCADE's codes are factor-reset credentials
     * rather than a parallel login factor.
     */
    expect(CHALLENGE).toMatch(/signOut\(\)/);
    expect(CHALLENGE).toMatch(/signed out|sign in/i);
    // And it never navigates into the app on a successful redemption.
    const recover = CHALLENGE.slice(CHALLENGE.indexOf("const recover = useCallback"));
    const body = recover.slice(0, recover.indexOf("}, [recoveryCode]);"));
    expect(body).not.toContain("window.location.assign(destination)");
  });

  it("guards the return address rather than trusting the URL", () => {
    // `next` comes from the query string. Without the same guard the sign-in
    // screen uses, this would forward somebody to any address an attacker put
    // in a link — a redirect that appears to come from inside OCADE.
    expect(CHALLENGE).toContain("safeNext(");
  });

  it("reloads the document after a successful challenge", () => {
    /*
     * The access token is replaced with one carrying `aal2`, and the guard
     * reads assurance in `beforeLoad`. A soft navigation can reuse the already
     * resolved route context and bounce straight back to this screen — a loop
     * that looks like the correct code being rejected.
     */
    const confirm = CHALLENGE.slice(CHALLENGE.indexOf("const confirm = useCallback"));
    expect(confirm.slice(0, 1200)).toContain("window.location.assign");
  });
});
