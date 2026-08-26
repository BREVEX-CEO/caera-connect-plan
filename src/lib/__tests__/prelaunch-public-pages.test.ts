import { describe, expect, it } from "vitest";
import {
  prelaunchResponse,
  renderPrelaunchPublicPage,
} from "../launch/prelaunch-response";
import type { LaunchGateDecision } from "../launch/launch-window";

const lockedDecision: LaunchGateDecision = {
  open: false,
  reason: "locked_before_launch",
  internal: false,
  retryAfterSeconds: 300,
};

describe("pre-launch public verification pages", () => {
  it("renders distinct public Home, Privacy and Terms documents", () => {
    const home = renderPrelaunchPublicPage("/");
    const privacy = renderPrelaunchPublicPage("/privacy");
    const terms = renderPrelaunchPublicPage("/terms");

    expect(home).toContain("OCADE is a local-first AI workspace");
    expect(home).toContain('href="/privacy"');
    expect(home).toContain('href="/terms"');
    expect(privacy).toContain("Privacy notice");
    expect(terms).toContain("Terms of service");
    expect(home).not.toBe(privacy);
    expect(home).not.toBe(terms);
    expect(privacy).not.toBe(terms);
  });

  it("serves verification pages with indexable 200 responses", async () => {
    for (const pathname of ["/", "/privacy", "/terms"]) {
      const response = prelaunchResponse(pathname, lockedDecision);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-robots-tag")).toContain("index");
      expect(response.headers.get("x-ocade-launch-state")).toBe(
        "prelaunch-public-information",
      );
      expect(await response.text()).toContain("CARCC CADANE");
    }
  });

  it("keeps the authenticated application locked", async () => {
    const response = prelaunchResponse("/auth", lockedDecision);

    expect(response.status).toBe(503);
    expect(response.headers.get("x-ocade-launch-state")).toBe("prelaunch");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    /*
     * The locked page used to print "Planned launch <date>". It says only that
     * access is not open yet, which is the honest thing to tell a stranger
     * about a date that may still move. What is asserted instead is that the
     * page still explains itself and still points at the public information —
     * a bare 503 is a dead end.
     */
    const body = await response.text();
    expect(body).toContain("not open yet");
    expect(body).not.toMatch(/Planned launch/);
  });

  it("advertises the public pages in robots and sitemap while locked", async () => {
    const robots = await prelaunchResponse("/robots.txt", lockedDecision).text();
    const sitemap = await prelaunchResponse("/sitemap.xml", lockedDecision).text();

    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Allow: /privacy");
    expect(robots).toContain("Allow: /terms");
    expect(sitemap).toContain("https://ocade.in/</loc>");
    expect(sitemap).toContain("https://ocade.in/privacy</loc>");
    expect(sitemap).toContain("https://ocade.in/terms</loc>");
  });
});
