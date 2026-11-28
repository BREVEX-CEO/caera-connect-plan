/** SESSION-02: the recency and second-factor decision, branch by branch, and the claim reader. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  assuranceFromClaims,
  decideAssurance,
  RECENT_PROOF_MS,
  type SessionAssurance,
} from "../../src/lib/security/assurance.ts";

const now = 1_700_000_000_000;
const high = { level: "aal2" } as const;
const session = (over: Partial<SessionAssurance>): SessionAssurance => ({
  current: "aal2",
  hasVerifiedFactor: true,
  lastAuthenticatedAt: now - 1000,
  ...over,
});

test("an enrolled account at aal1 is asked for its factor first, never to sign in again", () => {
  const d = decideAssurance({
    requires: high,
    session: session({ current: "aal1", lastAuthenticatedAt: now - 99 * RECENT_PROOF_MS }),
    now,
  });
  assert.equal(d.allowed === false && d.reason, "factor_required");
});

test("a recent aal2 proof is allowed; the window edge is inclusive; one millisecond later is refused", () => {
  assert.equal(decideAssurance({ requires: high, session: session({}), now }).allowed, true);
  assert.equal(
    decideAssurance({
      requires: high,
      session: session({ lastAuthenticatedAt: now - RECENT_PROOF_MS }),
      now,
    }).allowed,
    true,
  );
  const late = decideAssurance({
    requires: high,
    session: session({ lastAuthenticatedAt: now - RECENT_PROOF_MS - 1 }),
    now,
  });
  assert.equal(late.allowed === false && late.reason, "reauthentication_required");
});

test("an unknown proof time and a proof from the future both fail closed", () => {
  for (const lastAuthenticatedAt of [null, now + 5000])
    assert.equal(
      decideAssurance({ requires: high, session: session({ lastAuthenticatedAt }), now }).allowed,
      false,
    );
});

test("an account with no factor is held to recency and told that enrolling would raise the bar", () => {
  const d = decideAssurance({
    requires: high,
    session: session({ current: "aal1", hasVerifiedFactor: false, lastAuthenticatedAt: null }),
    now,
  });
  assert.ok(d.allowed === false && d.enrollmentWouldHelp);
  const stale = decideAssurance({
    requires: high,
    session: session({ hasVerifiedFactor: true, lastAuthenticatedAt: 0 }),
    now,
  });
  assert.ok(
    stale.allowed === false && !stale.enrollmentWouldHelp,
    "a second factor does not make an old proof recent",
  );
});

test("a custom window is honoured and the default is the strict one", () => {
  const s = session({ lastAuthenticatedAt: now - 60_000 });
  assert.equal(
    decideAssurance({ requires: { level: "aal2", reauthWithinMs: 30_000 }, session: s, now })
      .allowed,
    false,
  );
  assert.equal(
    decideAssurance({ requires: { level: "aal2", reauthWithinMs: 120_000 }, session: s, now })
      .allowed,
    true,
  );
});

test("claims are read in seconds, the latest proof wins, and junk is unknown", () => {
  const s = assuranceFromClaims(
    { aal: "aal2", amr: [{ timestamp: 1000 }, { timestamp: 2000 }, { timestamp: "x" }, null] },
    true,
  );
  assert.deepEqual(s, { current: "aal2", hasVerifiedFactor: true, lastAuthenticatedAt: 2_000_000 });
  assert.equal(assuranceFromClaims({ aal: "weird" }, false).current, "aal1");
  assert.equal(assuranceFromClaims(null, false).lastAuthenticatedAt, null);
});
