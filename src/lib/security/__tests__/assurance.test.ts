import { describe, expect, it } from "vitest";
import {
  RECENT_PROOF_MS,
  assuranceFromClaims,
  decideAssurance,
  type SessionAssurance,
} from "@/lib/security/assurance";

const NOW = Date.parse("2026-09-02T12:00:00.000Z");

function session(over: Partial<SessionAssurance> = {}): SessionAssurance {
  return {
    current: "aal1",
    hasVerifiedFactor: false,
    lastAuthenticatedAt: NOW - 60_000,
    ...over,
  };
}

describe("a second factor is required of accounts that have one", () => {
  it("refuses an aal1 session on an enrolled account", () => {
    const decision = decideAssurance({
      requires: { level: "aal2" },
      session: session({ hasVerifiedFactor: true, current: "aal1" }),
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("factor_required");
  });

  it("allows the same session once it has reached aal2", () => {
    expect(
      decideAssurance({
        requires: { level: "aal2" },
        session: session({ hasVerifiedFactor: true, current: "aal2" }),
        now: NOW,
      }).allowed,
    ).toBe(true);
  });

  it("does NOT demand aal2 from an account that cannot reach it", () => {
    /*
     * THE RULE THAT WOULD LOCK PEOPLE OUT IF IT WERE WRITTEN THE OBVIOUS WAY.
     *
     * An account with no factor can never produce an aal2 session, so a flat
     * "aal2 required" on a high-risk action would refuse its own owner
     * permanently — and the pressure would then be to weaken the rule for
     * everybody. Recency carries this case instead.
     */
    const decision = decideAssurance({
      requires: { level: "aal2" },
      session: session({ hasVerifiedFactor: false, current: "aal1" }),
      now: NOW,
    });
    expect(decision.allowed).toBe(true);
  });

  it("asks for the factor BEFORE asking for a fresh sign-in", () => {
    /*
     * Both are wrong at once here: no factor used, and the proof is ancient.
     * Reporting "sign in again" would send the person round a loop — signing in
     * again produces another aal1 session, and the action still refuses.
     */
    const decision = decideAssurance({
      requires: { level: "aal2" },
      session: session({
        hasVerifiedFactor: true,
        current: "aal1",
        lastAuthenticatedAt: NOW - 30 * 24 * 60 * 60 * 1000,
      }),
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("factor_required");
  });
});

describe("assurance is not recency", () => {
  it("refuses a fully assured session whose proof has gone stale", () => {
    // The unlocked-laptop case. aal2 all day is still not "you, just now".
    const decision = decideAssurance({
      requires: { level: "aal2" },
      session: session({
        hasVerifiedFactor: true,
        current: "aal2",
        lastAuthenticatedAt: NOW - RECENT_PROOF_MS - 1,
      }),
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("reauthentication_required");
  });

  it("allows a proof exactly at the boundary, and refuses one past it", () => {
    const at = decideAssurance({
      requires: { level: "aal1" },
      session: session({ lastAuthenticatedAt: NOW - RECENT_PROOF_MS }),
      now: NOW,
    });
    const past = decideAssurance({
      requires: { level: "aal1" },
      session: session({ lastAuthenticatedAt: NOW - RECENT_PROOF_MS - 1 }),
      now: NOW,
    });
    expect(at.allowed).toBe(true);
    expect(past.allowed).toBe(false);
  });

  it("fails CLOSED when the proof time is unknown", () => {
    // A token with no methods list is not evidence of a recent sign-in.
    const decision = decideAssurance({
      requires: { level: "aal1" },
      session: session({ lastAuthenticatedAt: null }),
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
  });

  it("fails CLOSED on a proof that claims to be from the future", () => {
    // A clock disagreement, or a forged timestamp. Either way `now - proved`
    // goes negative and would pass a naive "less than the window" check.
    const decision = decideAssurance({
      requires: { level: "aal1" },
      session: session({ lastAuthenticatedAt: NOW + 60_000 }),
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
  });

  it("honours a tighter window declared by the action", () => {
    const decision = decideAssurance({
      requires: { level: "aal1", reauthWithinMs: 30_000 },
      session: session({ lastAuthenticatedAt: NOW - 60_000 }),
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
  });
});

describe("what the person is told", () => {
  it("suggests enrolling only when enrolling would actually raise the bar", () => {
    const unenrolled = decideAssurance({
      requires: { level: "aal2" },
      session: session({ hasVerifiedFactor: false, lastAuthenticatedAt: null }),
      now: NOW,
    });
    const enrolled = decideAssurance({
      requires: { level: "aal2" },
      session: session({ hasVerifiedFactor: true, current: "aal2", lastAuthenticatedAt: null }),
      now: NOW,
    });
    expect(unenrolled.allowed).toBe(false);
    expect(enrolled.allowed).toBe(false);
    if (!unenrolled.allowed) expect(unenrolled.enrollmentWouldHelp).toBe(true);
    // Already enrolled: repeating the suggestion reads as the product not
    // knowing its own state, and it is not the fix for a stale proof anyway.
    if (!enrolled.allowed) expect(enrolled.enrollmentWouldHelp).toBe(false);
  });

  it("always has a sentence, and never names the mechanism", () => {
    for (const input of [
      { hasVerifiedFactor: true, current: "aal1" as const },
      { lastAuthenticatedAt: null },
    ]) {
      const decision = decideAssurance({
        requires: { level: "aal2" },
        session: session(input),
        now: NOW,
      });
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.message.length).toBeGreaterThan(40);
        expect(decision.message).not.toMatch(/aal|jwt|token|claim/i);
      }
    }
  });
});

describe("reading the facts out of a token", () => {
  it("takes the LATEST proof, not the first", () => {
    // Sign in, then complete a factor challenge. The challenge is the recent
    // one; reading `amr[0]` would age every session by its own sign-in.
    const facts = assuranceFromClaims(
      {
        aal: "aal2",
        amr: [
          { method: "password", timestamp: 1_700_000_000 },
          { method: "totp", timestamp: 1_700_000_600 },
        ],
      },
      true,
    );
    expect(facts.current).toBe("aal2");
    expect(facts.lastAuthenticatedAt).toBe(1_700_000_600_000);
  });

  it("reads Supabase's seconds as seconds", () => {
    // Read as milliseconds these land in 1970 and nothing is ever recent.
    const facts = assuranceFromClaims(
      { amr: [{ method: "otp", timestamp: 1_700_000_000 }] },
      false,
    );
    expect(facts.lastAuthenticatedAt).toBe(1_700_000_000_000);
    expect(new Date(facts.lastAuthenticatedAt!).getUTCFullYear()).toBeGreaterThan(2000);
  });

  it("treats anything that is not aal2 as aal1", () => {
    for (const aal of [undefined, null, "aal1", "AAL2", 2, {}]) {
      expect(assuranceFromClaims({ aal }, false).current).toBe("aal1");
    }
  });

  it("survives a token with no methods list, reporting an unknown proof time", () => {
    for (const claims of [null, undefined, {}, { amr: "not-an-array" }, { amr: [null, 7] }]) {
      expect(assuranceFromClaims(claims as never, false).lastAuthenticatedAt).toBeNull();
    }
  });
});

describe("every signed-in server function asks the database about the second factor", () => {
  const client = (answer: { data: unknown; error: unknown }) => {
    const calls: string[] = [];
    return {
      calls,
      rpc: async (fn: string) => {
        calls.push(fn);
        return answer as { data: unknown; error: null };
      },
    };
  };

  it("lets an answered (aal2) session through without asking", async () => {
    const { meetsSecondFactor } = await import("../session-middleware");
    const db = client({ data: false, error: null });
    expect(await meetsSecondFactor(db, { aal: "aal2", sub: "u1" })).toBe(true);
    expect(db.calls).toEqual([]);
  });

  it("refuses an enrolled account's password-only session, as the database says", async () => {
    const { meetsSecondFactor } = await import("../session-middleware");
    const refused = client({ data: null, error: { code: "42501", hint: "factor_required" } });
    expect(await meetsSecondFactor(refused, { aal: "aal1", sub: "u2", session_id: "s2" })).toBe(
      false,
    );
    const plain = client({ data: true, error: null });
    expect(await meetsSecondFactor(plain, { aal: "aal1", sub: "u3", session_id: "s3" })).toBe(true);
  });

  it("fails closed when the database cannot answer", async () => {
    const { meetsSecondFactor } = await import("../session-middleware");
    const down = client({ data: null, error: { code: "08006", message: "connection failure" } });
    await expect(
      meetsSecondFactor(down, { aal: "aal1", sub: "u4", session_id: "s4" }),
    ).rejects.toThrow(/could not check/);
  });
});
