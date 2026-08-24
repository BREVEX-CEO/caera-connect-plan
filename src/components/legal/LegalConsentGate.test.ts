import { describe, expect, it } from "vitest";
import {
  LEGAL_CONSENT_VERSION,
  needsLegalConsent,
  readLegalConsent,
  usesAccountConsentReceipt,
} from "./LegalConsentGate";

describe("mandatory legal consent gate", () => {
  it("gates product, demo, authentication and settings routes but not public legal pages", () => {
    expect(needsLegalConsent("/demo/ocade")).toBe(true);
    expect(needsLegalConsent("/ocade/work")).toBe(true);
    expect(needsLegalConsent("/auth")).toBe(true);
    expect(needsLegalConsent("/settings/privacy")).toBe(true);
    expect(needsLegalConsent("/privacy")).toBe(false);
    expect(needsLegalConsent("/terms")).toBe(false);
    expect(needsLegalConsent("/download")).toBe(false);
  });

  it("never initializes account state from an anonymous public route", () => {
    for (const pathname of [
      "/",
      "/products/ocade",
      "/pricing",
      "/download",
      "/company",
      "/founder/haans-antoni",
      "/terms",
      "/privacy",
      "/status",
      "/faq",
      "/search",
      "/auth",
      "/demo/ocade",
      "/demo/control",
    ]) {
      expect(usesAccountConsentReceipt(pathname), pathname).toBe(false);
    }

    expect(usesAccountConsentReceipt("/ocade/work")).toBe(true);
    expect(usesAccountConsentReceipt("/settings/privacy")).toBe(true);
  });

  it("accepts only the current version with both acknowledgements", () => {
    const acceptedAt = new Date().toISOString();
    const storage = {
      getItem: () =>
        JSON.stringify({
          version: LEGAL_CONSENT_VERSION,
          acceptedAt,
          terms: true,
          privacy: true,
        }),
    };
    expect(readLegalConsent(storage)).toMatchObject({ acceptedAt, terms: true, privacy: true });
    expect(
      readLegalConsent({
        getItem: () => JSON.stringify({ version: "old", acceptedAt, terms: true, privacy: true }),
      }),
    ).toBeNull();
    expect(
      readLegalConsent({
        getItem: () => JSON.stringify({ version: LEGAL_CONSENT_VERSION, acceptedAt, terms: true }),
      }),
    ).toBeNull();
  });
});
