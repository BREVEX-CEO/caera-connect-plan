/**
 * THE THREE WAYS SOMEBODY ELSE COULD HAVE TAKEN AN OCADE ACCOUNT.
 *
 * Each of these tests is a defect that was live in the shipped source, not a
 * hypothetical. They are written as the attack, so that a future edit that
 * reopens one fails with the attack's own name.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { opensResetForm, readRecoveryEvidence } from "../recovery-link";
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  describeResend,
  friendlyOtpError,
  secondsUntilResend,
} from "../otp";

const read = (p: string) => readFileSync(p, "utf8");

/**
 * The file with its prose removed.
 *
 * Needed because a comment EXPLAINING a safety property satisfies a test that
 * only greps for the property's name — and that is not hypothetical: the
 * password-change check below passed against a body where the call had been
 * replaced by a constant, purely on the strength of the comment above it
 * naming the function. A gate that a comment can satisfy is a gate that will
 * eventually be satisfied by nothing else.
 */
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("a session is not a reset link", () => {
  it("refuses a bare visit to /reset-password", () => {
    const evidence = readRecoveryEvidence("https://ocade.test/reset-password");
    expect(evidence.kind).toBe("none");
    expect(opensResetForm(evidence)).toBe(false);
  });

  it("opens only for a link that actually carries a recovery token", () => {
    const good = readRecoveryEvidence(
      "https://ocade.test/reset-password#access_token=abc&refresh_token=def&type=recovery",
    );
    expect(opensResetForm(good)).toBe(true);
  });

  it("refuses a token issued for anything other than recovery", () => {
    for (const type of ["signup", "magiclink", "invite", "email_change"]) {
      const evidence = readRecoveryEvidence(
        `https://ocade.test/reset-password#access_token=abc&type=${type}`,
      );
      expect(opensResetForm(evidence), `type=${type} must not open the form`).toBe(false);
    }
  });

  it("refuses a recovery type with no token behind it", () => {
    expect(
      opensResetForm(readRecoveryEvidence("https://ocade.test/reset-password#type=recovery")),
    ).toBe(false);
  });

  it("treats a PKCE code as a claim to be exchanged, never as the proof", () => {
    const evidence = readRecoveryEvidence("https://ocade.test/reset-password?code=xyz");
    expect(evidence).toEqual({ kind: "recovery_code", code: "xyz" });
    expect(opensResetForm(evidence)).toBe(false);
  });

  it("reports the provider's reason when the link has already expired", () => {
    const evidence = readRecoveryEvidence(
      "https://ocade.test/reset-password#error=access_denied&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(evidence).toEqual({
      kind: "error",
      message: "Email link is invalid or has expired",
    });
  });

  it("fails closed on a URL it cannot parse", () => {
    expect(readRecoveryEvidence("not a url").kind).toBe("none");
  });

  it("the route no longer accepts SIGNED_IN or a pre-existing session", () => {
    const source = read("src/routes/reset-password.tsx");
    expect(source).not.toMatch(/event\s*===\s*"SIGNED_IN"/);
    expect(source).not.toMatch(/setLinkValid\(Boolean\(data\.session\)\)/);
    expect(source).toContain("readRecoveryEvidence");
  });
});

describe("changing a password while signed in proves it is still you", () => {
  it("proves identity before updateUser", () => {
    /*
     * The proof used to be an inline `signInWithPassword` here, and this test
     * named it. It now goes through `proveIdentityWithPassword`, the one
     * authority the sign-in-methods panel and the organization screen also use
     * — the inline copies had already diverged on whether an `aal2` session
     * counted as proof, which is how a passer-by at an unlocked laptop got to
     * change how somebody signs in.
     *
     * So the ordering is asserted at the call site and the MECHANISM is
     * asserted where it now lives. Checking only the call site would let the
     * authority become a no-op; checking only the authority would let this
     * screen stop calling it.
     */
    const source = readCode("src/routes/_authenticated/settings.security.tsx");
    const change = source.slice(
      source.indexOf("async function changePassword"),
      source.indexOf("async function sendReset"),
    );
    expect(change).toContain("proveIdentityWithPassword");
    expect(change.indexOf("proveIdentityWithPassword")).toBeLessThan(
      change.indexOf("updateUser({ password: pw })"),
    );

    const authority = readCode("src/lib/security/reauthentication.ts");
    expect(authority).toContain("signInWithPassword");
  });

  it("will not submit without the current password", () => {
    expect(read("src/routes/_authenticated/settings.security.tsx")).toContain("!currentPw");
  });
});

describe("a one-time code never quietly creates an account", () => {
  it("asks the person which they meant, rather than assuming", () => {
    const source = read("src/routes/auth.tsx");
    // As code, not as the comment explaining why it is gone.
    expect(source).not.toMatch(/^\s*shouldCreateUser:\s*true/m);
    expect(source).toContain("shouldCreateUser: creating");
    expect(source).toContain("signupIntent");
  });

  it("carries that intent to the verify screen so a resend cannot change it", () => {
    expect(read("src/routes/auth.tsx")).toContain('intent: creating ? "signup" : "signin"');
    const verify = read("src/routes/auth.verify.tsx");
    expect(verify).toContain('shouldCreateUser: intent === "signup"');
  });

  it("says the same thing whether or not the address has an account", () => {
    const source = read("src/routes/auth.tsx");
    expect(source).toContain("OTP_SENT_NOTICE");
    // The refusal for a non-existent user is deliberately not surfaced.
    expect(source).toMatch(/signups\? not allowed/);
  });
});

describe("the resend button cannot be hammered", () => {
  it("is closed immediately after a code has just been sent", () => {
    const now = 1_000_000;
    expect(secondsUntilResend(now, now)).toBe(OTP_RESEND_COOLDOWN_SECONDS);
  });

  it("opens again once the cooldown has passed", () => {
    const now = 1_000_000;
    expect(secondsUntilResend(now - OTP_RESEND_COOLDOWN_SECONDS * 1000, now)).toBe(0);
    expect(secondsUntilResend(null, now)).toBe(0);
  });

  it("counts down a second at a time", () => {
    const now = 1_000_000;
    expect(secondsUntilResend(now - 30_000, now)).toBe(30);
    expect(secondsUntilResend(now - 59_500, now)).toBe(1);
  });

  it("clamps a timestamp from the future instead of locking the button for hours", () => {
    const now = 1_000_000;
    expect(secondsUntilResend(now + 86_400_000, now)).toBe(OTP_RESEND_COOLDOWN_SECONDS);
  });

  it("puts the wait in the label, where a screen reader will find it", () => {
    expect(describeResend(0)).toMatch(/send another code/i);
    expect(describeResend(1)).toBe("You can request another code in 1 second");
    expect(describeResend(42)).toBe("You can request another code in 42 seconds");
  });

  it("starts its clock on the attempt, not the success", () => {
    const verify = read("src/routes/auth.verify.tsx");
    const resend = verify.slice(verify.indexOf("async function resend"));
    expect(resend.indexOf("setLastSentAt(Date.now())")).toBeLessThan(
      resend.indexOf("signInWithOtp"),
    );
  });
});

describe("the provider never speaks to the user in its own words", () => {
  it("says the same thing for a wrong code and an address with no account", () => {
    expect(friendlyOtpError("Invalid token")).toBe(friendlyOtpError("User not found"));
  });

  it("explains a rate limit as something to wait out", () => {
    expect(
      friendlyOtpError("For security purposes, you can only request this after 43 seconds"),
    ).toMatch(/wait a minute/i);
    expect(friendlyOtpError("Request rate limit reached")).toMatch(/wait a minute/i);
  });

  it("distinguishes an expired code, which needs a new one", () => {
    expect(friendlyOtpError("Token has expired")).toMatch(/expired/i);
  });

  it("never repeats the provider's own text back", () => {
    for (const raw of [
      "AuthApiError: Invalid login credentials at https://xyz.supabase.co/auth/v1/token",
      "otp_disabled: Signups not allowed for otp",
    ]) {
      const friendly = friendlyOtpError(raw);
      expect(friendly).not.toContain("supabase");
      expect(friendly).not.toContain("AuthApiError");
      expect(friendly).not.toContain("otp_disabled");
    }
  });
});
