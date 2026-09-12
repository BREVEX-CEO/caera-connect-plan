import { describe, expect, it } from "vitest";
import {
  CALLING_COUNTRIES,
  callingCountry,
  describePhoneProblem,
  flagFor,
  toE164,
} from "../phone-numbers";

describe("turning what somebody types into E.164", () => {
  it("attaches the picked country's calling code", () => {
    expect(toE164("9876543210", "IN")).toEqual({ ok: true, e164: "+919876543210" });
    expect(toE164("5550109999", "US")).toEqual({ ok: true, e164: "+15550109999" });
  });

  it("drops a national trunk zero, which is the quiet way a number becomes unreachable", () => {
    expect(toE164("07700900123", "GB")).toEqual({ ok: true, e164: "+447700900123" });
  });

  it("ignores spaces, brackets, dots and dashes", () => {
    expect(toE164("(555) 010-9999", "US")).toEqual({ ok: true, e164: "+15550109999" });
    expect(toE164("98765 43210", "IN")).toEqual({ ok: true, e164: "+919876543210" });
  });

  it("lets an explicit + override the picker, because it is the more specific statement", () => {
    expect(toE164("+61 400 000 000", "IN")).toEqual({ ok: true, e164: "+61400000000" });
  });

  it("refuses what it cannot make valid, rather than sending it to a provider", () => {
    expect(toE164("", "IN")).toEqual({ ok: false, reason: "empty" });
    expect(toE164("12", "IN")).toEqual({ ok: false, reason: "too_short" });
    expect(toE164("+1234567", "US")).toEqual({ ok: false, reason: "too_short" });
    expect(toE164("9876543210987654", "IN")).toEqual({ ok: false, reason: "too_long" });
    expect(toE164("call me maybe", "IN")).toEqual({ ok: false, reason: "not_a_number" });
  });

  it("says why in OCADE's own words, never a provider's", () => {
    for (const reason of ["empty", "too_short", "too_long", "not_a_number"] as const) {
      const message = describePhoneProblem(reason);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/supabase|twilio|provider|E\.164/i);
    }
  });
});

describe("the country list", () => {
  it("offers a country whose calling code is digits only", () => {
    for (const country of CALLING_COUNTRIES) {
      expect(country.dial).toMatch(/^\d{1,4}$/);
      expect(country.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("falls back to the default rather than returning nothing", () => {
    expect(callingCountry("ZZ").code).toBe("IN");
  });

  it("builds a flag from the code rather than shipping an image", () => {
    expect(flagFor("IN")).toBe("🇮🇳");
    expect(flagFor("not-a-code")).toBe("");
  });
});
