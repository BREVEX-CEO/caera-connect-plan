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
  prelaunchResponse,
  renderPrelaunchPage,
} from "../launch/prelaunch-response";
import { releaseHealthResponse } from "../release-health";

const PRODUCTION_HOST = "ocade.example";
const READY = { OCADE_LAUNCH_READY: "true" };

function gate(now: number, env: Record<string, unknown> = {}) {
  return evaluateLaunchGate({ now, hostname: PRODUCTION_HOST, env });
}

describe("OCADE production launch gate", () => {
  it("pins the launch instant and the public date label", () => {
    expect(LAUNCH_AT_ISO).toBe("2026-08-28T02:58:00.000Z");
    expect(LAUNCH_PUBLIC_DATE_LABEL).toBe("28 August 2026");
  });

  it("stays locked one millisecond before the target", () => {
    const decision = gate(LAUNCH_AT_MS - 1, READY);
    expect(decision.open).toBe(false);
    expect(decision.reason).toBe("locked_before_launch");
  });

  it("opens exactly at the target only when readiness is set", () => {
    expect(gate(LAUNCH_AT_MS, READY).open).toBe(true);
    expect(gate(LAUNCH_AT_MS).open).toBe(false);
    expect(gate(LAUNCH_AT_MS).reason).toBe("locked_not_ready");
  });

  it("stays locked after the target when readiness is missing or false", () => {
    const later = LAUNCH_AT_MS + 86_400_000;
    for (const env of [{}, { OCADE_LAUNCH_READY: "false" }, { OCADE_LAUNCH_READY: "1" }]) {
      const decision = gate(later, env);
      expect(decision.open).toBe(false);
      expect(decision.reason).toBe("locked_not_ready");
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
      expect(
        evaluateLaunchGate({ now: LAUNCH_AT_MS - 1, hostname: host, env: {} }).open,
      ).toBe(true);
    }
    // The published production host is never treated as internal.
    expect(isInternalHost("ocade.lovable.app")).toBe(false);
    expect(isInternalHost(PRODUCTION_HOST)).toBe(false);
  });

  it("never discloses the exact launch time in the pre-launch response", () => {
    const decision = gate(LAUNCH_AT_MS - 1);
    const html = renderPrelaunchPage();
    for (const secret of ["08:28", "02:58", LAUNCH_AT_ISO, String(LAUNCH_AT_MS)]) {
      expect(html).not.toContain(secret);
    }
    expect(html).toContain(`Planned launch ${LAUNCH_PUBLIC_DATE_LABEL}`);
    expect(html).not.toMatch(/<script/i);
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });

  it("answers locked page, API and asset paths with 503 and no-store", async () => {
    const decision = gate(LAUNCH_AT_MS - 1);
    for (const path of ["/", "/auth", "/ocade", "/sitemap.xml", "/assets/index-abc123.js"]) {
      const response = prelaunchResponse(path, decision);
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
      expect(response.headers.get("retry-after")).toBe(String(decision.retryAfterSeconds));
      await expect(response.text()).resolves.not.toContain("02:58");
    }
  });

  it("serves a disallow-all robots directive before launch and no sitemap link", async () => {
    const decision = gate(LAUNCH_AT_MS - 1);
    expect(PRELAUNCH_ALLOWED_PATHS.has("/robots.txt")).toBe(true);
    const response = prelaunchResponse("/robots.txt", decision);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Disallow: /");
    expect(body).not.toContain("Sitemap:");
    expect(body).not.toContain("Allow: /");
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
