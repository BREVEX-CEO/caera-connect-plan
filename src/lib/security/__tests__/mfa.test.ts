import { describe, expect, it, vi } from "vitest";
import {
  answerChallenge,
  currentAssurance,
  describeMfaError,
  discardUnverifiedFactors,
  listFactors,
  listVerifiedFactors,
  removeFactor,
  startEnrollment,
  verifyEnrollment,
} from "@/lib/security/mfa";

/**
 * A Supabase double that records the calls and answers what it is told to.
 *
 * Only `auth.mfa` is implemented, and it is cast at the boundary — a
 * hand-written stand-in for the whole client would be a second thing to keep
 * correct. Every function under test takes an override for exactly this.
 */
function fakeSupabase(
  options: {
    factors?: { id: string; friendly_name?: string; status: string; created_at?: string }[];
    aal?: { currentLevel?: string; nextLevel?: string };
    enrollResult?: unknown;
    enrollError?: { message: string };
    challengeError?: { message: string };
    verifyError?: { message: string };
    unenrollError?: { message: string };
  } = {},
) {
  const calls: { name: string; args?: unknown }[] = [];
  const auth = {
    async getSession() {
      calls.push({ name: "getSession" });
      return { data: { session: { access_token: "token-abc" } }, error: null };
    },
    mfa: {
      async listFactors() {
        calls.push({ name: "listFactors" });
        return { data: { all: options.factors ?? [], totp: [] }, error: null };
      },
      async getAuthenticatorAssuranceLevel(jwt?: string) {
        calls.push({ name: "getAal", args: jwt });
        return { data: options.aal ?? {}, error: null };
      },
      async enroll(args: unknown) {
        calls.push({ name: "enroll", args });
        if (options.enrollError) return { data: null, error: options.enrollError };
        return {
          data: options.enrollResult ?? {
            id: "factor-1",
            totp: { uri: "otpauth://totp/OCADE:me?secret=ABC", secret: "ABC" },
          },
          error: null,
        };
      },
      async challenge(args: unknown) {
        calls.push({ name: "challenge", args });
        if (options.challengeError) return { data: null, error: options.challengeError };
        return { data: { id: "challenge-1" }, error: null };
      },
      async verify(args: unknown) {
        calls.push({ name: "verify", args });
        return { data: null, error: options.verifyError ?? null };
      },
      async unenroll(args: unknown) {
        calls.push({ name: "unenroll", args });
        return { data: null, error: options.unenrollError ?? null };
      },
    },
  };
  return { client: { auth }, calls };
}

describe("an unverified factor protects nothing and is not counted", () => {
  const both = [
    { id: "verified-1", friendly_name: "iPhone", status: "verified", created_at: "2026-01-01" },
    { id: "started-1", friendly_name: "Abandoned", status: "unverified" },
  ];

  it("reports both when asked for all factors", () => {
    return expect(listFactors(fakeSupabase({ factors: both }).client)).resolves.toHaveLength(2);
  });

  it("counts ONLY the verified one as protection", async () => {
    /*
     * THE DEFECT THIS PREVENTS. Enrollment creates the factor immediately, and
     * it stays unverified until a code is entered. Counting it would show
     * "protected" on an account that is not, and — worse — would let somebody
     * lower their own bar by starting a setup they never finish, because the
     * assurance rule asks whether a VERIFIED factor exists.
     */
    const verified = await listVerifiedFactors(fakeSupabase({ factors: both }).client);
    expect(verified.map((factor) => factor.id)).toEqual(["verified-1"]);
  });

  it("names a factor that has no name rather than showing a blank row", async () => {
    const factors = await listFactors(
      fakeSupabase({ factors: [{ id: "a", status: "verified" }] }).client,
    );
    expect(factors[0]!.name).toBe("Authenticator app");
  });

  it("removes abandoned enrollments, and never the verified one", async () => {
    /*
     * Every abandoned QR screen leaves a factor behind. They count against
     * Supabase's per-account limit, so somebody interrupted three times can
     * find they cannot enroll at all with nothing on screen explaining why.
     */
    const fake = fakeSupabase({
      factors: [
        ...both,
        { id: "started-2", friendly_name: "Also abandoned", status: "unverified" },
      ],
    });
    const removed = await discardUnverifiedFactors(fake.client);
    expect(removed).toBe(2);
    const unenrolled = fake.calls
      .filter((call) => call.name === "unenroll")
      .map((call) => (call.args as { factorId: string }).factorId);
    expect(unenrolled).toEqual(["started-1", "started-2"]);
    expect(unenrolled).not.toContain("verified-1");
  });

  it("does not let a failed tidy-up become a failed enrollment", async () => {
    const fake = fakeSupabase({
      factors: [{ id: "started-1", status: "unverified" }],
      unenrollError: { message: "network" },
    });
    await expect(discardUnverifiedFactors(fake.client)).resolves.toBe(0);
  });
});

describe("enrollment", () => {
  it("returns both a QR URI and a typeable secret", async () => {
    // A camera is not always an option — a desktop authenticator, a locked-down
    // phone, a person who cannot use one. The secret is the way in without it.
    const started = await startEnrollment("iPhone", fakeSupabase().client);
    expect(started.uri).toContain("otpauth://");
    expect(started.secret).toBe("ABC");
    expect(started.factorId).toBe("factor-1");
  });

  it("insists on a name, before calling Supabase at all", async () => {
    const fake = fakeSupabase();
    await expect(startEnrollment("   ", fake.client)).rejects.toThrow(/name/i);
    expect(fake.calls).toEqual([]);
  });

  it("challenges and then verifies, in that order", async () => {
    const fake = fakeSupabase();
    await verifyEnrollment("factor-1", "123456", fake.client);
    expect(fake.calls.map((call) => call.name)).toEqual(["challenge", "verify"]);
    expect(fake.calls[1]!.args).toMatchObject({
      factorId: "factor-1",
      challengeId: "challenge-1",
      code: "123456",
    });
  });

  it("accepts a code typed with the spaces the app displays", async () => {
    // Authenticator apps render "123 456". Refusing that is refusing a correct
    // code because of how it was shown.
    const fake = fakeSupabase();
    await answerChallenge("factor-1", " 123 456 ", fake.client);
    expect((fake.calls[1]!.args as { code: string }).code).toBe("123456");
  });

  it("does not report success when the verification failed", async () => {
    const fake = fakeSupabase({ verifyError: { message: "invalid TOTP code entered" } });
    await expect(verifyEnrollment("factor-1", "000000", fake.client)).rejects.toThrow(
      /not accepted/i,
    );
  });

  it("surfaces a failed challenge rather than verifying against nothing", async () => {
    const fake = fakeSupabase({ challengeError: { message: "challenge not found" } });
    await expect(verifyEnrollment("factor-1", "123456", fake.client)).rejects.toThrow();
    expect(fake.calls.map((call) => call.name)).not.toContain("verify");
  });
});

describe("assurance is reported, not guessed", () => {
  it("reads the level Supabase gives", async () => {
    const fake = fakeSupabase({ aal: { currentLevel: "aal2", nextLevel: "aal2" } });
    await expect(currentAssurance(fake.client)).resolves.toEqual({ current: "aal2", next: "aal2" });
  });

  it("treats an outstanding challenge as aal1 now, aal2 available", async () => {
    // This exact difference is what tells the app to show the code prompt
    // rather than the enrollment screen.
    const fake = fakeSupabase({ aal: { currentLevel: "aal1", nextLevel: "aal2" } });
    await expect(currentAssurance(fake.client)).resolves.toEqual({ current: "aal1", next: "aal2" });
  });

  it("PASSES THE ACCESS TOKEN, so factors are read from the account", async () => {
    /*
     * THE DEFECT THIS CAUGHT, found by driving the journey in a real browser
     * rather than by reading the code.
     *
     * Called with no argument, `getAuthenticatorAssuranceLevel` reads
     * `session.user.factors` out of the STORED session — the copy localStorage
     * holds from the last sign-in. `getUser()` refreshes over the network but
     * never writes the user back into that stored session, so the factor list
     * there is frozen.
     *
     * The result: enroll on a laptop, and every other device reports "no second
     * factor" until its session happens to refresh. The route gate never fires
     * there, and MFA is an ornament everywhere except the device that set it up
     * — while every unit test passes.
     */
    const fake = fakeSupabase({ aal: { currentLevel: "aal1", nextLevel: "aal2" } });
    await currentAssurance(fake.client);
    const aal = fake.calls.find((call) => call.name === "getAal");
    expect(aal?.args, "the token must be passed").toBe("token-abc");
  });

  it("treats anything unrecognised as the LOWER level", async () => {
    for (const aal of [{}, { currentLevel: null }, { currentLevel: "AAL2" }]) {
      const fake = fakeSupabase({ aal: aal as never });
      await expect(currentAssurance(fake.client)).resolves.toMatchObject({ current: "aal1" });
    }
  });
});

describe("what the person is told when it goes wrong", () => {
  it("explains a wrong code in terms of what to do next", () => {
    expect(describeMfaError({ message: "invalid TOTP code entered" })).toMatch(/thirty seconds/i);
  });

  it("distinguishes a code that expired from one that was wrong", () => {
    const expired = describeMfaError({ message: "mfa challenge has expired" });
    const wrong = describeMfaError({ message: "invalid TOTP code entered" });
    expect(expired).not.toBe(wrong);
    expect(expired).toMatch(/too long/i);
  });

  it("says why a rate limit exists rather than just refusing", () => {
    expect(describeMfaError({ message: "over_request_rate_limit" })).toMatch(/guessing/i);
  });

  it("passes an unrecognised message through instead of inventing a reason", () => {
    /*
     * A wrong explanation costs more than an unfamiliar one: it sends somebody
     * to fix something that is not broken. Anything this module does not
     * recognise is shown as Supabase said it.
     */
    expect(describeMfaError({ message: "something entirely new" })).toBe("something entirely new");
  });

  it("never returns an empty sentence", () => {
    for (const error of [null, {}, { message: "" }]) {
      expect(describeMfaError(error as never).length).toBeGreaterThan(10);
    }
  });

  it("never shows a raw error code to a person", () => {
    for (const code of ["mfa_verification_failed", "mfa_challenge_expired", "insufficient_aal"]) {
      expect(describeMfaError({ message: "x", code })).not.toContain(code);
    }
  });
});

describe("removing a factor", () => {
  it("asks Supabase, which is the authority on whether it is allowed", async () => {
    // Deliberately no local assurance check: Supabase requires aal2 and refuses
    // otherwise, and OCADE's own gate runs at the surface. A third check here
    // would be a third place to get it wrong.
    const fake = fakeSupabase();
    await removeFactor("factor-1", fake.client);
    expect(fake.calls).toEqual([{ name: "unenroll", args: { factorId: "factor-1" } }]);
  });

  it("reports a refusal rather than pretending the factor is gone", async () => {
    const fake = fakeSupabase({ unenrollError: { message: "AAL2 required" } });
    await expect(removeFactor("factor-1", fake.client)).rejects.toThrow(/authenticator app/i);
  });
});

describe("the module holds no second store of factors", () => {
  it("reads every answer from Supabase rather than from state of its own", async () => {
    /*
     * PLAN.md §B: complete MFA through the existing authority, do not build
     * another login system. Two systems that both believe they know whether you
     * are authenticated will eventually disagree, and the disagreement is
     * always resolved in favour of whichever one an attacker reached.
     *
     * Checked by answering differently on two consecutive calls: a module
     * caching its own copy would return the first answer twice.
     */
    let call = 0;
    const shifting = {
      auth: {
        mfa: {
          async listFactors() {
            call += 1;
            return {
              data: { all: call === 1 ? [{ id: "a", status: "verified" }] : [], totp: [] },
              error: null,
            };
          },
        },
      },
    };
    await expect(listVerifiedFactors(shifting)).resolves.toHaveLength(1);
    await expect(listVerifiedFactors(shifting)).resolves.toHaveLength(0);
  });

  it("uses the shared client when no override is given", async () => {
    /*
     * The override exists for tests. Production must go through the ONE
     * authenticated client — a second connection would carry its own session,
     * and a factor list read from a different session is a factor list for a
     * different account.
     *
     * The shared client is built lazily from configuration, so this supplies
     * throwaway values to let it exist. Nothing reaches the network: the call
     * under test is replaced before it is made, and the URL is not a real host.
     */
    const previous = {
      url: process.env["SUPABASE_URL"],
      key: process.env["SUPABASE_PUBLISHABLE_KEY"],
    };
    process.env["SUPABASE_URL"] = "https://mfa-wiring-probe.invalid";
    process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_mfa_wiring_probe";
    try {
      const module = await import("@/integrations/supabase/client");
      const spy = vi.spyOn(module.supabase.auth.mfa, "listFactors").mockResolvedValue({
        data: { all: [], totp: [] },
        error: null,
      } as never);
      await listFactors();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    } finally {
      if (previous.url === undefined) delete process.env["SUPABASE_URL"];
      else process.env["SUPABASE_URL"] = previous.url;
      if (previous.key === undefined) delete process.env["SUPABASE_PUBLISHABLE_KEY"];
      else process.env["SUPABASE_PUBLISHABLE_KEY"] = previous.key;
    }
  });
});
