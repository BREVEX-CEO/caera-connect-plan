import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * WHAT THE SIGN-IN SCREENS ARE AND ARE NOT ALLOWED TO DO.
 *
 * Asserted against the source, because every rule here is "this code must not
 * contain that": a second identity authority, a provider's own error text, an
 * unthrottled send, or a redirect target resolved by a hand-rolled check. None
 * of them has a state to observe afterwards — the only moment they are visible
 * is before they ship.
 */

const SIGN_IN = readFileSync("src/routes/auth.index.tsx", "utf8");
const VERIFY = readFileSync("src/routes/auth.verify.tsx", "utf8");
const CALLBACK = readFileSync("src/routes/auth.callback.tsx", "utf8");
const RESET = readFileSync("src/routes/reset-password.tsx", "utf8");
const SCREENS = [
  ["sign-in", SIGN_IN],
  ["verify", VERIFY],
  ["callback", CALLBACK],
  ["reset-password", RESET],
] as const;

describe("Supabase is the only identity authority", () => {
  it.each(SCREENS)("%s reaches auth only through the shared client", (_name, source) => {
    // Every screen loads the one client on demand. A second auth SDK, or a
    // direct fetch to an auth endpoint, would be a second way to make a session.
    expect(source).toContain("loadSupabaseClient");
    expect(source).not.toMatch(/@lovable|createClient\(|\/auth\/v1\//);
  });

  it("offers only the providers this product actually has", () => {
    expect(SIGN_IN).toContain('provider: "google"');
    /*
     * Comments stripped first. The screen's own documentation records that it
     * used to offer Apple and Microsoft buttons for providers nobody had
     * configured, which is the reason to keep that paragraph rather than a
     * reason to fail — what matters is what it RENDERS.
     */
    const rendered = SIGN_IN.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    expect(rendered).not.toMatch(/apple|microsoft|facebook|github/i);
  });
});

describe("the ways in", () => {
  it("are Google and an email code, and nothing else", () => {
    expect(SIGN_IN).toContain("Continue with Google");
    expect(SIGN_IN).toContain("signInWithOtp({ email");
  });

  /*
   * PHONE IS GONE, AND THE SCREEN MUST NOT GROW IT BACK.
   *
   * Sending SMS needs an external provider account OCADE does not have, so a
   * phone tab could only refuse. A method that cannot authenticate is worse
   * than an absent one: it is the one somebody reaches for when the others give
   * them trouble.
   */
  it("offer no phone code, because OCADE cannot send one", () => {
    const rendered = SIGN_IN.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    expect(rendered).not.toMatch(/phone|sms|tel|e164|calling/i);
    expect(VERIFY).not.toMatch(/type: "sms"/);
  });

  /*
   * AND NEITHER MAY THE FAILURE MESSAGES.
   *
   * Three OAuth hints offered "phone or email" as the way out of a failed
   * Google sign-in, so the one moment a person was already having trouble was
   * the moment OCADE sent them to a method it does not have.
   */
  it("never offer phone sign-in as the way out of a failed one", () => {
    const copy = readFileSync("src/lib/auth/oauth-errors.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    expect(copy).not.toMatch(/phone|sms/i);
  });

  it("keep the password off the first screen", () => {
    // A password is optional and managed under Account; `/reset-password`
    // remains for the people who set one.
    expect(SIGN_IN).not.toContain('type="password"');
    expect(RESET).toContain('type={visible ? "text" : "password"}');
  });

  it("verify exactly six digits", () => {
    expect(VERIFY).toContain("\\d{6}");
    expect(VERIFY).toContain("maxLength={6}");
  });
});

describe("what a failure may say", () => {
  it.each([
    ["sign-in", SIGN_IN],
    ["verify", VERIFY],
  ])("%s never renders the provider's own text", (_name, source) => {
    // Both screens pass provider errors through the shared translator, which
    // is also what keeps "no user found" and "wrong code" the same sentence.
    expect(source).toContain("friendlyOtpError");
    expect(source).not.toMatch(/setError\((?:err|error|sendError)\.message\)/);
  });

  it("throttles sending and verifying rather than letting a script through", () => {
    for (const source of [SIGN_IN, VERIFY]) {
      expect(source).toContain("secondsUntilAllowed");
      expect(source).toContain("recordFailure");
      expect(source).toContain("saveThrottle");
    }
  });
});

describe("where a screen may send somebody afterwards", () => {
  it.each([
    ["sign-in", SIGN_IN],
    ["verify", VERIFY],
    ["callback", CALLBACK],
  ] as const)("%s resolves the destination through safeNext", (_name, source) => {
    expect(source).toContain("safeNext");
    // The hand-rolled version of this check — starts with "/", not "//" —
    // accepts strings the shared resolver rejects.
    expect(source).not.toMatch(/startsWith\("\/\/"\)/);
  });
});
