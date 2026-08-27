import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Every way into an account backs off, and none of them quotes the provider.
 *
 * Asserted against the source rather than through the UI because what is being
 * protected is a property of the code — "there is no path that retries at full
 * speed" — and a component test can only prove the paths it happens to render.
 * The failure this catches is a fifth sign-in form added later without the two
 * lines, which reads perfectly well in review.
 */

const AUTH = readFileSync("src/routes/auth.tsx", "utf8");
const VERIFY = readFileSync("src/routes/auth.verify.tsx", "utf8");
const RESET = readFileSync("src/routes/reset-password.tsx", "utf8");

/** Every call that can be retried against an account. */
const GUARDED_CALLS = [
  "signInWithPassword",
  "signUp",
  "resetPasswordForEmail",
  "signInWithOtp",
  "verifyOtp",
];

describe("every attempt path backs off", () => {
  it("guards each account call on the sign-in screen", () => {
    for (const call of ["signInWithPassword", "signUp", "resetPasswordForEmail", "signInWithOtp"]) {
      expect(AUTH, `${call} is not guarded`).toContain(call);
    }
    expect(AUTH).toContain('blockedFor("password_signin"');
    expect(AUTH).toContain('blockedFor("password_reset"');
    expect(AUTH).toContain('blockedFor("otp_send"');
    expect(AUTH).toContain('noteAttempt("signup"');
  });

  it("guards code entry, and disables the button while the wait runs", () => {
    expect(VERIFY).toContain('loadThrottle("otp_verify"');
    expect(VERIFY).toContain("secondsUntilAllowed");
    expect(VERIFY).toContain("disabled={busy || wait > 0}");
  });

  it("no longer pretends to stop guessing while letting the next guess through", () => {
    /*
     * The counter this replaced showed a longer sentence from the fifth failure
     * and then allowed the sixth immediately. Its absence is asserted so it
     * cannot come back as a "simpler" version of the same thing.
     */
    expect(VERIFY).not.toContain("attempts.current");
    expect(VERIFY).not.toMatch(/OCADE stops guessing/);
  });
});

describe("the provider is never quoted to the user", () => {
  it.each([
    ["the sign-in screen", AUTH],
    ["the code screen", VERIFY],
    ["the password reset screen", RESET],
  ])("does not render a raw provider message on %s", (_name, source) => {
    /*
     * `setError(err.message)` is the shape being forbidden: it names the
     * service, sometimes names an internal endpoint, and its wording
     * distinguishes "no such user" from "wrong password" — which is precisely
     * what somebody working through a list of addresses wants to learn.
     * Reading err.message to CLASSIFY it is fine and is what the mappers do.
     */
    expect(source).not.toMatch(/setError\(\s*err\.message\s*\)/);
    expect(source).not.toMatch(/setError\(\s*`\$\{err\.message\}/);
  });

  it("routes provider text through the mapper on every screen", () => {
    for (const source of [AUTH, VERIFY, RESET]) {
      expect(source).toContain("friendlyOtpError");
    }
  });
});

describe("the guarded call list is complete", () => {
  it("names every Supabase auth call the three screens make", () => {
    const found = new Set<string>();
    for (const source of [AUTH, VERIFY, RESET]) {
      for (const match of source.matchAll(/supabase\.auth\.([a-zA-Z]+)\(/g)) {
        found.add(match[1]);
      }
    }
    /*
     * `updateUser` (setting the new password) and `getSession`/`onAuthStateChange`
     * are not attempt paths: the first is reached only by someone already
     * holding a valid recovery link, and the others read state. Everything else
     * that can be retried against an address must appear in GUARDED_CALLS, so a
     * new one added later fails here rather than shipping unguarded.
     */
    const attemptPaths = [...found].filter(
      (name) =>
        !["updateUser", "getSession", "onAuthStateChange", "signOut", "getUser"].includes(name),
    );
    for (const name of attemptPaths) {
      expect(GUARDED_CALLS, `${name} is a new attempt path with no backoff`).toContain(name);
    }
  });
});
