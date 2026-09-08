import { describe, expect, it, vi } from "vitest";
import {
  assuranceRefusalOf,
  checkAssurance,
  proveIdentityWithPassword,
  readSessionAssurance,
} from "../reauthentication";
import { HIGH_RISK } from "../assurance-middleware";
import { RECENT_PROOF_MS } from "../assurance";

/**
 * The live half of the assurance rule: reading what a session can show for
 * itself, and turning a database refusal into the right next step.
 *
 * The rule itself is `assurance.ts` and is tested exhaustively there. What is
 * checked here is everything that could make the rule read the WRONG FACTS —
 * an unreadable token, an unreadable factor list, a `details` field that is not
 * one of the two tokens — because each of those has a safe answer and an unsafe
 * one, and the unsafe one is silent.
 */

/** A Supabase client stub, shaped like the parts this module touches. */
function client(options: {
  claims?: Record<string, unknown> | null;
  claimsThrows?: boolean;
  factors?: { status: string }[];
  factorsThrows?: boolean;
  signInError?: { message: string } | null;
  onSignIn?: (input: { email: string; password: string }) => void;
}) {
  return {
    auth: {
      getClaims: async () => {
        if (options.claimsThrows) throw new Error("token unreadable");
        return { data: options.claims === undefined ? null : { claims: options.claims } };
      },
      mfa: {
        listFactors: async () => {
          if (options.factorsThrows) throw new Error("factors unreadable");
          return { data: { all: options.factors ?? [] } };
        },
      },
      signInWithPassword: async (input: { email: string; password: string }) => {
        options.onSignIn?.(input);
        return { error: options.signInError ?? null };
      },
    },
  };
}

const secondsAgo = (seconds: number) => Math.floor(Date.now() / 1000) - seconds;

describe("reading what the session can show", () => {
  it("takes the level and the latest proof out of the token", async () => {
    const session = await readSessionAssurance(
      client({
        claims: {
          aal: "aal2",
          amr: [
            { method: "password", timestamp: secondsAgo(600) },
            { method: "totp", timestamp: secondsAgo(30) },
          ],
        },
        factors: [{ status: "verified" }],
      }),
    );
    expect(session.current).toEqual("aal2");
    expect(session.hasVerifiedFactor).toBe(true);
    // The LATEST entry, not the first: answering a factor is fresh proof.
    expect(Date.now() - (session.lastAuthenticatedAt ?? 0)).toBeLessThan(60_000);
  });

  it("treats a token it cannot read as a session with no known proof", async () => {
    const session = await readSessionAssurance(client({ claimsThrows: true }));
    expect(session.lastAuthenticatedAt).toBeNull();
    expect(session.current).toEqual("aal1");
  });

  it("does not count an unverified enrollment as a factor", async () => {
    const session = await readSessionAssurance(
      client({ claims: { aal: "aal1" }, factors: [{ status: "unverified" }] }),
    );
    expect(session.hasVerifiedFactor).toBe(false);
  });

  it("falls back to no factor when the list cannot be read", async () => {
    // Lenient on the factor question and strict on recency, which is the right
    // way round: an outage must not demand a challenge nobody can answer.
    const session = await readSessionAssurance(
      client({ claims: { aal: "aal1", amr: [{ method: "password", timestamp: secondsAgo(5) }] } }),
    );
    expect(session.hasVerifiedFactor).toBe(false);
  });
});

describe("deciding whether to ask", () => {
  it("allows a session that proved itself a moment ago", async () => {
    const decision = await checkAssurance(
      HIGH_RISK,
      client({ claims: { aal: "aal1", amr: [{ method: "password", timestamp: secondsAgo(5) }] } }),
    );
    expect(decision.allowed).toBe(true);
  });

  it("asks for a password once the proof is older than the window", async () => {
    const stale = Math.floor(RECENT_PROOF_MS / 1000) + 60;
    const decision = await checkAssurance(
      HIGH_RISK,
      client({
        claims: { aal: "aal1", amr: [{ method: "password", timestamp: secondsAgo(stale) }] },
      }),
    );
    expect(decision).toMatchObject({ allowed: false, reason: "reauthentication_required" });
  });

  it("asks for the code when the account is enrolled and the session is not", async () => {
    const decision = await checkAssurance(
      HIGH_RISK,
      client({
        claims: { aal: "aal1", amr: [{ method: "password", timestamp: secondsAgo(5) }] },
        factors: [{ status: "verified" }],
      }),
    );
    expect(decision).toMatchObject({ allowed: false, reason: "factor_required" });
  });

  it("still asks a session that answered its code hours ago", async () => {
    // The whole reason recency exists: assurance says how strongly, not when.
    const stale = Math.floor(RECENT_PROOF_MS / 1000) + 3_600;
    const decision = await checkAssurance(
      HIGH_RISK,
      client({
        claims: { aal: "aal2", amr: [{ method: "totp", timestamp: secondsAgo(stale) }] },
        factors: [{ status: "verified" }],
      }),
    );
    expect(decision).toMatchObject({ allowed: false, reason: "reauthentication_required" });
  });
});

describe("proving identity with the current password", () => {
  it("signs in against the account's own address on the same session", async () => {
    const onSignIn = vi.fn();
    const outcome = await proveIdentityWithPassword(
      "person@example.com",
      "correct horse",
      client({ onSignIn }),
    );
    expect(outcome).toEqual({ proved: true });
    expect(onSignIn).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "correct horse",
    });
  });

  it("reports a wrong password without saying which part was wrong", async () => {
    const outcome = await proveIdentityWithPassword(
      "person@example.com",
      "guess",
      client({ signInError: { message: "Invalid login credentials" } }),
    );
    expect(outcome).toEqual({ proved: false, reason: "wrong_password" });
  });

  it("refuses rather than guessing when the address is unknown", async () => {
    const onSignIn = vi.fn();
    const outcome = await proveIdentityWithPassword(null, "anything", client({ onSignIn }));
    expect(outcome).toEqual({ proved: false, reason: "no_email" });
    expect(onSignIn, "a sign-in was attempted with no address").not.toHaveBeenCalled();
  });
});

describe("recognising the database's refusal", () => {
  it("reads the two tokens the schema raises", () => {
    expect(assuranceRefusalOf({ details: "factor_required" })).toEqual("factor_required");
    expect(assuranceRefusalOf({ details: "reauthentication_required" })).toEqual(
      "reauthentication_required",
    );
  });

  it("does not invent a refusal from an ordinary failure", () => {
    // Every other error must stay an error. Turning a constraint violation into
    // a password prompt would ask somebody to prove themselves in order to be
    // told, again, that they are the last owner.
    expect(assuranceRefusalOf({ message: "This is the last owner." })).toBeNull();
    expect(assuranceRefusalOf({ details: "Key (id)=(1) already exists." })).toBeNull();
    expect(assuranceRefusalOf(null)).toBeNull();
    expect(assuranceRefusalOf("factor_required")).toBeNull();
  });
});
