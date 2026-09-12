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

const SIGN_IN = readFileSync("src/routes/auth.tsx", "utf8");
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
  it("are Google, an email code and a phone code", () => {
    expect(SIGN_IN).toContain("Continue with Google");
    expect(SIGN_IN).toContain("signInWithOtp({ email");
    expect(SIGN_IN).toContain("signInWithOtp({ phone");
  });

  it("normalise a phone number through the one resolver", () => {
    expect(SIGN_IN).toContain("toE164(");
    expect(SIGN_IN).toContain("CALLING_COUNTRIES");
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
