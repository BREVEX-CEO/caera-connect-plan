import { describe, expect, it } from "vitest";
import {
  detectClientPlatform,
  evaluatePublicWindowsRelease,
  type PublicWindowsRelease,
} from "../packaging/public-download";
import { billingHandoffMessage, buildBillingHandoffUrl } from "../payments/browser-handoff";

const complete: PublicWindowsRelease = {
  version: "1.0.0",
  url: "https://downloads.ocade.in/OCADE-Setup-1.0.0.exe",
  sha256: "a".repeat(64),
  authenticodeSigned: true,
  updateSignatureVerified: true,
  cleanDeviceTested: true,
  publisher: "CARCC CADANE",
};

describe("public installer publication gate", () => {
  it("refuses an unsigned build even when it has a URL", () => {
    expect(evaluatePublicWindowsRelease({ ...complete, authenticodeSigned: false })).toEqual({
      ready: false,
      reason: "signing_required",
    });
  });

  it("refuses a signed build without update and clean-device evidence", () => {
    expect(evaluatePublicWindowsRelease({ ...complete, cleanDeviceTested: false })).toEqual({
      ready: false,
      reason: "verification_required",
    });
  });

  it("accepts only a complete HTTPS release manifest", () => {
    expect(evaluatePublicWindowsRelease(complete)).toMatchObject({
      ready: true,
      url: complete.url,
    });
    expect(evaluatePublicWindowsRelease({ ...complete, url: "http://ocade.in/setup.exe" })).toEqual(
      {
        ready: false,
        reason: "invalid_manifest",
      },
    );
  });

  it("detects mobile before desktop tokens and recognises common platforms", () => {
    expect(detectClientPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(detectClientPlatform("Mozilla/5.0 (Linux; Android 15)")).toBe("android");
    expect(detectClientPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(
      "ios",
    );
    expect(detectClientPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)")).toBe("macos");
  });
});

describe("native-to-browser billing handoff", () => {
  it("builds a same-purpose pricing URL without embedding a payment result", () => {
    const url = new URL(
      buildBillingHandoffUrl({
        origin: "https://ocade.in",
        source: "desktop",
        plan: "std_8d",
      }),
    );
    expect(url.origin).toBe("https://ocade.in");
    expect(url.pathname).toBe("/pricing");
    expect(url.searchParams.get("source")).toBe("desktop");
    expect(url.searchParams.get("plan")).toBe("std_8d");
    expect(url.searchParams.has("paid")).toBe(false);
    expect(url.searchParams.has("entitlement")).toBe(false);
  });

  it("tells native users that server verification controls access", () => {
    expect(billingHandoffMessage("desktop")).toMatch(/server verifies the payment/i);
    expect(billingHandoffMessage("web")).toBeNull();
  });
});
