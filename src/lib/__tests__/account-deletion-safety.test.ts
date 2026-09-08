import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * THE MOST IRREVERSIBLE THING IN THE PRODUCT, AND THE ORDER IT HAPPENS IN.
 *
 * PLAN.md §O lists what account deletion has to do beyond deleting rows, and
 * three of the items are about SEQUENCE rather than presence:
 *
 *   "Revoke sessions before destructive account completion."
 *   "Bound remaining JWT validity and validate `session_id` for sensitive
 *    operations."
 *   "Do not delete Offline Intelligence during account deletion."
 *
 * An order is invisible in review and untestable through a running product
 * without destroying a real account, so the source is read: the checks must
 * appear before the first delete, and the local cleanup must go through the
 * authority that cannot reach a model key.
 *
 * The alternative — asserting only that the functions are called somewhere —
 * would pass on a version that revoked sessions after everything was already
 * gone, which is the version that does not help anybody.
 */

const SOURCE = readFileSync("src/lib/account.functions.ts", "utf8");
const CARD = readFileSync("src/components/settings/DeleteAccountCard.tsx", "utf8");

/** Where something first appears in the handler, or -1. */
function at(needle: string, haystack = SOURCE): number {
  return haystack.indexOf(needle);
}

describe("deletion verifies who is asking, before it destroys anything", () => {
  it("was read at all, so a broken scan cannot pass", () => {
    expect(SOURCE).toContain("deleteMyAccount");
    expect(SOURCE.length).toBeGreaterThan(2000);
  });

  it("requires a second factor and recent proof, not just a signed-in session", () => {
    // A typed phrase is consent; consent is not identity. Somebody who finds an
    // unlocked browser can type the phrase as easily as the owner can.
    expect(SOURCE).toContain("requireAssurance(HIGH_RISK)");
  });

  it("verifies the session is still live BEFORE the first delete", () => {
    /*
     * A JWT outlives its session. The window between "I revoked that stolen
     * browser" and "its token expires" is exactly when somebody would use it to
     * delete the account out from under its owner.
     */
    const liveness = at("callerSessionIsLive(");
    const firstDelete = at(".delete()");
    expect(liveness).toBeGreaterThan(-1);
    expect(firstDelete).toBeGreaterThan(-1);
    expect(liveness).toBeLessThan(firstDelete);
  });

  it("revokes every other session BEFORE the first delete", () => {
    const revoke = at("ocade_revoke_other_account_sessions");
    const firstDelete = at(".delete()");
    expect(revoke).toBeGreaterThan(-1);
    expect(revoke).toBeLessThan(firstDelete);
  });

  it("deletes the sign-in identity last", () => {
    const identity = at("auth.admin.deleteUser(");
    const firstDelete = at(".delete()");
    expect(identity).toBeGreaterThan(firstDelete);
  });

  it("never takes the target account from the request", () => {
    // There is no parameter here that names a user, which is what makes "delete
    // somebody else's account" impossible to ask for rather than merely refused.
    expect(SOURCE).toContain("const userId = context.userId;");
    expect(SOURCE).not.toMatch(/data\.(userId|user_id|accountId)/);
  });
});

describe("the receipt says what happened without saying what was deleted", () => {
  it("carries a reference, a time and classes — never content", () => {
    expect(SOURCE).toContain("AccountDeletionReceipt");
    expect(SOURCE).toContain("reference:");
    expect(SOURCE).toContain("completedAt:");
    // Classes, not records: no subject, no body, no title anywhere in the shape.
    expect(SOURCE).not.toMatch(/receipt\.(subject|body|messages|conversations)\b/);
  });

  it("does not derive the reference from the account id", () => {
    /*
     * A reference computed from the user id would let anybody holding both work
     * backwards, which re-identifies an account that was just erased.
     */
    const reference = SOURCE.slice(at("function deletionReference"));
    expect(reference).toContain("crypto.getRandomValues");
    expect(reference).not.toContain("userId");
  });

  it("records the deletion where the record outlives the account", () => {
    // `compliance_audit_log.user_id` is ON DELETE SET NULL, so the line survives
    // with the subject removed: proof an erasure happened, holding nobody.
    const insert = at('from("compliance_audit_log")');
    const identity = at("auth.admin.deleteUser(");
    expect(insert).toBeGreaterThan(identity);
    expect(SOURCE).toContain('action: "account.deleted"');
  });

  it("is shown to the person rather than flashed as a toast", () => {
    // It is the last moment they have any relationship with the account, and
    // the reference is the only thing they can quote afterwards.
    expect(CARD).toContain("setReceipt(outcome.receipt)");
    expect(CARD).toContain("receipt.reference");
  });
});

describe("Offline Intelligence is not collateral", () => {
  it("clears local data through the authority that cannot reach a model key", () => {
    expect(CARD).toContain("deleteLocalData(");
    expect(CARD).not.toMatch(/localStorage\s*\.\s*clear\s*\(/);
  });

  it("tells the person their model was kept, and that nothing was downloaded", () => {
    const text = CARD.replace(/\s+/g, " ");
    expect(text).toMatch(/Offline Intelligence on this device was/i);
    expect(text).toMatch(/nothing here started a download/i);
  });

  it("says so on the receipt itself, not only on the screen", () => {
    expect(SOURCE).toContain("offlineIntelligencePreserved: true");
  });
});
