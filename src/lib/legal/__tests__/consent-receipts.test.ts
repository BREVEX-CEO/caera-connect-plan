/**
 * CONSENT HAS TO BE PROVABLE, AND ASKING TWICE IS ITS OWN HARM.
 *
 * Acceptance lived only in localStorage. That failed in both directions at
 * once: the person was asked again on every device and after every clear-site-
 * data, having already agreed — and a gate that reappears is a gate people
 * learn to click through — while OCADE could not answer "which version did
 * this account accept, and when?", because the only evidence sat on the
 * person's own machine where they could erase it and nobody else could read it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  coversCurrentDocuments,
  LEGAL_CONSENT_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "../consent-receipts";

describe("re-acceptance is asked for once, and only when it means something", () => {
  const current = { terms: "t2", privacy: "p2" };

  it("does not re-ask somebody whose acceptance covers both current documents", () => {
    expect(coversCurrentDocuments({ termsVersion: "t2", privacyVersion: "p2" }, current)).toBe(
      true,
    );
  });

  it("re-asks when the terms change", () => {
    expect(coversCurrentDocuments({ termsVersion: "t1", privacyVersion: "p2" }, current)).toBe(
      false,
    );
  });

  it("re-asks when the privacy notice changes, independently of the terms", () => {
    /*
     * The reason the two versions are separate columns. A combined string
     * could not answer "did they accept THIS privacy notice?" after a
     * terms-only revision without guessing.
     */
    expect(coversCurrentDocuments({ termsVersion: "t2", privacyVersion: "p1" }, current)).toBe(
      false,
    );
  });

  it("treats no receipt as not accepted, rather than assuming the best", () => {
    expect(coversCurrentDocuments(null, current)).toBe(false);
  });

  it("keys the local receipt on both documents, so the two cannot drift", () => {
    expect(LEGAL_CONSENT_VERSION).toContain(TERMS_VERSION);
    expect(LEGAL_CONSENT_VERSION).toContain(PRIVACY_VERSION);
  });
});

describe("historical consent evidence cannot be overwritten", () => {
  const migration = readFileSync(
    "supabase/migrations/20260823140000_legal_consent_receipts.sql",
    "utf8",
  );

  it("grants select and insert to a signed-in person, and nothing else", () => {
    expect(migration).toMatch(/grant select, insert on table public\.legal_consent_receipts/i);
    expect(migration).not.toMatch(/grant[^;]*update[^;]*legal_consent_receipts/i);
    expect(migration).not.toMatch(/grant[^;]*delete[^;]*legal_consent_receipts/i);
  });

  it("creates no update or delete policy at all", () => {
    /*
     * The substance of "append-only". A consent record its own subject can
     * edit is not evidence of anything, and one they can delete cannot answer
     * a question asked next year.
     */
    expect(migration).not.toMatch(/create policy[^;]*for update[^;]*legal_consent_receipts/is);
    expect(migration).not.toMatch(/for update\s+on public\.legal_consent_receipts/i);
    expect(migration).not.toMatch(/for delete\s+on public\.legal_consent_receipts/i);
  });

  it("scopes both policies to the person's own rows", () => {
    expect(migration).toMatch(/using \(auth\.uid\(\) = user_id\)/);
    expect(migration).toMatch(/with check \(auth\.uid\(\) = user_id\)/);
  });

  it("records no IP address, user agent or location", () => {
    /*
     * Scoped to the COLUMN LIST, not the whole file — the comment above the
     * table says these are not stored, and an earlier version of this test
     * failed on its own explanation.
     */
    const columns = migration
      .slice(
        migration.indexOf("create table if not exists public.legal_consent_receipts"),
        migration.indexOf(");"),
      )
      .toLowerCase();
    for (const forbidden of ["ip_address", "user_agent", "inet", "location", "country"]) {
      expect(columns, `${forbidden} is a column on the consent table`).not.toContain(forbidden);
    }
  });

  it("is verified and reversible like every other migration", () => {
    expect(
      readFileSync(
        "supabase/verification/20260823140000_legal_consent_receipts_verify.sql",
        "utf8",
      ),
    ).toContain("UPDATE");
    expect(
      readFileSync("supabase/rollback/20260823140000_legal_consent_receipts_rollback.sql", "utf8"),
    ).toContain("DROP TABLE");
  });
});

describe("the gate consults the account, and fails closed when it cannot", () => {
  const gate = readFileSync("src/components/legal/LegalConsentGate.tsx", "utf8");

  it("checks this device first, so an accepted person is not made to wait", () => {
    const effect = gate.slice(gate.indexOf("const local = readLegalConsent()"));
    expect(effect.indexOf("readLegalConsent()")).toBeLessThan(
      effect.indexOf("latestServerReceipt"),
    );
  });

  it("records the acceptance against the account when there is one", () => {
    expect(gate).toContain("recordServerConsent(userId");
  });

  it("leaves the gate up when the server cannot be reached", () => {
    /*
     * `latestServerReceipt` returns null on failure and `coversCurrentDocuments`
     * turns null into false, so an unreachable database asks again rather than
     * assuming an agreement OCADE cannot see. Asking twice is a smaller harm
     * than recording consent that was never given.
     */
    expect(gate).toContain("setAccepted(coversCurrentDocuments(receipt))");
  });
});
