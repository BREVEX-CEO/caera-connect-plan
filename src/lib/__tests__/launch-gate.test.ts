import { describe, expect, it } from "vitest";

import {
  LAUNCH_AT_ISO,
  LAUNCH_AT_MS,
  LAUNCH_PUBLIC_DATE_LABEL,
  evaluateLaunchGate,
  isInternalHost,
} from "../launch/launch-window";
import {
  PRELAUNCH_ALLOWED_PATHS,
  PRELAUNCH_PUBLIC_ASSET_PATHS,
  PRELAUNCH_PUBLIC_PATHS,
  prelaunchResponse,
  renderPrelaunchPage,
  renderPrelaunchPublicPage,
} from "../launch/prelaunch-response";
import { releaseHealthResponse } from "../release-health";
import { COMPANY_FACTS } from "@/config/company-facts";

const PRODUCTION_HOST = "ocade.example";
const RELOCKED = { OCADE_LAUNCH_READY: "false" };

function gate(now: number, env: Record<string, unknown> = {}) {
  return evaluateLaunchGate({ now, hostname: PRODUCTION_HOST, env });
}

describe("OCADE production launch gate", () => {
  /*
   * The instant is read from the single source that owns it rather than
   * retyped here. This assertion used to carry its own copy of the timestamp,
   * and when the launch was brought forward it failed as though the product
   * were broken — a test reporting that a deliberate decision was a defect.
   * What matters is that one module owns the instant and that the public label
   * agrees with it, and both are checkable without duplicating the value.
   */
  it("takes the launch instant from the one module that owns it", () => {
    expect(LAUNCH_AT_ISO).toBe(COMPANY_FACTS.launchAtIso);
    expect(LAUNCH_PUBLIC_DATE_LABEL).toBe(COMPANY_FACTS.foundingDateLabel);
    expect(Number.isFinite(LAUNCH_AT_MS)).toBe(true);

    // The public label must name the day the instant actually falls on where
    // the launch was announced (IST, UTC+5:30) — not the UTC day, which is a
    // different date for any launch instant before 05:30Z.
    const ist = new Date(LAUNCH_AT_MS + 5.5 * 60 * 60 * 1000);
    const label = `${ist.getUTCDate()} ${
      [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ][ist.getUTCMonth()]
    } ${ist.getUTCFullYear()}`;
    expect(LAUNCH_PUBLIC_DATE_LABEL).toBe(label);
  });

  it("stays locked one millisecond before the target", () => {
    const decision = gate(LAUNCH_AT_MS - 1);
    expect(decision.open).toBe(false);
    expect(decision.reason).toBe("locked_before_launch");
  });

  it("opens at the target without needing any variable to be set", () => {
    expect(gate(LAUNCH_AT_MS).open).toBe(true);
    expect(gate(LAUNCH_AT_MS).reason).toBe("open_launched");
  });

  /*
   * THE EMERGENCY RE-LOCK, WHICH THE RUNBOOK PROMISES AND WHICH WAS ABSENT.
   *
   * Opening the gate at launch removed the code that read this variable, so
   * "set OCADE_LAUNCH_READY=false and the gate closes on the next request"
   * silently stopped being true while every document still said it. It is read
   * again — but only in the closing direction, so a missing or malformed value
   * can never take a live product down.
   */
  it("closes again when an operator sets the re-lock to exactly false", () => {
    const later = LAUNCH_AT_MS + 86_400_000;
    const decision = gate(later, RELOCKED);
    expect(decision.open).toBe(false);
    expect(decision.reason).toBe("locked_not_ready");
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("stays open for every value that is not exactly false", () => {
    const later = LAUNCH_AT_MS + 86_400_000;
    for (const env of [
      {},
      { OCADE_LAUNCH_READY: "true" },
      { OCADE_LAUNCH_READY: "1" },
      { OCADE_LAUNCH_READY: "FALSE" },
      { OCADE_LAUNCH_READY: " false " },
      { OCADE_LAUNCH_READY: "" },
    ]) {
      const decision = gate(later, env);
      expect(decision.open).toBe(true);
      expect(decision.reason).toBe("open_launched");
    }
  });

  it("keeps local development and approved internal previews testable", () => {
    for (const host of [
      "localhost",
      "127.0.0.1",
      "id-preview--abc.lovable.app",
      "project--x-dev.lovable.app",
      "something.lovableproject.com",
    ]) {
      expect(isInternalHost(host)).toBe(true);
      expect(evaluateLaunchGate({ now: LAUNCH_AT_MS - 1, hostname: host, env: {} }).open).toBe(
        true,
      );
    }
    // The published production host is never treated as internal.
    expect(isInternalHost("ocade.lovable.app")).toBe(false);
    expect(isInternalHost(PRODUCTION_HOST)).toBe(false);
  });

  /*
   * THE ASSERTION THAT USED TO BE HERE SAID THE LOCKED PAGE PRINTS
   * "Planned launch 28 August 2026". It no longer does, and that is an
   * improvement rather than a regression: a countdown to a date the team may
   * still move is a promise made to strangers, and the page now says only that
   * access is not open yet. The half of this test that matters — that the exact
   * launch INSTANT never leaks, and that the locked page runs no script — is
   * kept and tightened to check the date label is absent too.
   */
  it("never discloses the launch time in the pre-launch response", () => {
    const decision = gate(LAUNCH_AT_MS - 1);
    const html = renderPrelaunchPage();
    for (const secret of ["08:28", "02:58", LAUNCH_AT_ISO, String(LAUNCH_AT_MS)]) {
      expect(html).not.toContain(secret);
    }
    expect(html).not.toMatch(/<script/i);
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });

  /*
   * `/` moved out of this list deliberately: the site root is now one of the
   * factual public pages served while the product is locked, so a visitor who
   * types the domain reads about OCADE instead of a 503. The authenticated
   * paths and the build assets are still refused, which is what the lock is for.
   */
  it("answers locked page, API and asset paths with 503 and no-store", async () => {
    const decision = gate(LAUNCH_AT_MS - 1);
    for (const path of ["/auth", "/ocade", "/assets/index-abc123.js"]) {
      const response = prelaunchResponse(path, decision);
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
      expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
      expect(response.headers.get("content-security-policy")).toContain(
        "script-src https://static.cloudflareinsights.com/beacon.min.js",
      );
      expect(response.headers.get("content-security-policy")).toContain(
        "https://static.cloudflareinsights.com/beacon.min.js/",
      );
      expect(response.headers.get("content-security-policy")).toContain("connect-src 'self'");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-ocade-launch-state")).toBe("prelaunch");
      expect(response.headers.get("retry-after")).toBe(String(decision.retryAfterSeconds));
      await expect(response.text()).resolves.not.toContain("02:58");
    }
  });

  it("keeps factual founder, company and product pages crawlable while the app is locked", async () => {
    const decision = gate(LAUNCH_AT_MS - 1);
    for (const path of ["/company", "/founder/haans-antoni", "/products/ocade"]) {
      expect(PRELAUNCH_PUBLIC_PATHS.has(path)).toBe(true);
      expect(PRELAUNCH_ALLOWED_PATHS.has(path)).toBe(true);
      const response = prelaunchResponse(path, decision);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toContain("index");
      expect(response.headers.get("x-ocade-launch-state")).toBe("prelaunch-public-information");
      expect(response.headers.get("content-security-policy")).toContain(
        "https://static.cloudflareinsights.com/beacon.min.js",
      );
      const html = await response.text();
      expect(html).toContain('rel="canonical"');
      expect(html).toContain('type="application/ld+json"');
      expect(html).toContain("CARCC CADANE");
      expect(html).not.toContain("02:58");
      expect(renderPrelaunchPublicPage(path)).toBe(html);
    }
    expect(PRELAUNCH_PUBLIC_ASSET_PATHS.has("/brand/ocade-carcc-wordmark.png")).toBe(true);
    expect(PRELAUNCH_PUBLIC_PATHS.has("/ocade")).toBe(false);
  });

  it("redirects trailing-slash factual paths to their crawlable canonical URL", () => {
    const response = prelaunchResponse("/products/ocade/", gate(LAUNCH_AT_MS - 1));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/products/ocade");
    expect(response.headers.get("x-robots-tag")).toContain("index");
    expect(response.headers.get("x-ocade-launch-state")).toBe("prelaunch-public-information");
  });

  it("serves a restrictive robots directive with the factual allowlist and sitemap", async () => {
    const decision = gate(LAUNCH_AT_MS - 1);
    expect(PRELAUNCH_ALLOWED_PATHS.has("/robots.txt")).toBe(true);
    const response = prelaunchResponse("/robots.txt", decision);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Disallow: /");
    expect(body).toContain("Allow: /company");
    expect(body).toContain("Allow: /founder/haans-antoni");
    expect(body).toContain("Sitemap: https://ocade.in/sitemap.xml");
  });

  it("serves only the factual pre-launch pages in the sitemap", async () => {
    const response = prelaunchResponse("/sitemap.xml", gate(LAUNCH_AT_MS - 1));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("https://ocade.in/company");
    expect(body).toContain("https://ocade.in/founder/haans-antoni");
    expect(body).toContain("https://ocade.in/products/ocade");
    expect(body).not.toContain("https://ocade.in/ocade");
  });

  it("keeps health available while locked without leaking the launch time", async () => {
    const response = releaseHealthResponse(new Request("https://ocade.example/api/health"));
    expect(response?.status).toBe(200);
    const body = await response!.text();
    expect(body).toContain('"status":"ok"');
    for (const secret of ["02:58", "08:28", LAUNCH_AT_ISO, "OCADE_LAUNCH_READY"]) {
      expect(body).not.toContain(secret);
    }
  });
});
