import { describe, expect, it } from "vitest";
import { OCADE_PUBLIC_LAUNCH_AT, productionLaunchGateResponse } from "../production-launch-gate";

const launchMs = Date.parse(OCADE_PUBLIC_LAUNCH_AT);

describe("production launch gate", () => {
  it("does not interfere with local development or Lovable previews", () => {
    expect(
      productionLaunchGateResponse(new Request("http://localhost:3000/"), undefined, launchMs - 1),
    ).toBeNull();
    expect(
      productionLaunchGateResponse(
        new Request("https://example.lovable.app/"),
        undefined,
        launchMs - 1,
      ),
    ).toBeNull();
  });

  it("fails closed on public production and Cloudflare preview hosts", () => {
    for (const host of [
      "ocade.in",
      "www.ocade.in",
      "ocade.caeracadane.workers.dev",
      "ocade-web.pages.dev",
    ]) {
      const response = productionLaunchGateResponse(
        new Request(`https://${host}/`),
        undefined,
        launchMs + 1,
      );
      expect(response?.status).toBe(503);
      expect(response?.headers.get("x-robots-tag")).toContain("noindex");
      expect(response?.headers.get("cache-control")).toContain("no-store");
    }
  });

  it("requires both readiness and the launch instant", () => {
    const request = new Request("https://ocade.in/");
    expect(
      productionLaunchGateResponse(request, { OCADE_LAUNCH_READY: "true" }, launchMs - 1)?.status,
    ).toBe(503);
    expect(
      productionLaunchGateResponse(request, { OCADE_LAUNCH_READY: "false" }, launchMs + 1)?.status,
    ).toBe(503);
    expect(
      productionLaunchGateResponse(request, { OCADE_LAUNCH_READY: "TRUE" }, launchMs + 1)?.status,
    ).toBe(503);
    expect(
      productionLaunchGateResponse(request, { OCADE_LAUNCH_READY: "true" }, launchMs),
    ).toBeNull();
  });

  it("keeps health reachable while blocking APIs and indexing", async () => {
    expect(
      productionLaunchGateResponse(
        new Request("https://ocade.in/api/health"),
        undefined,
        launchMs - 1,
      ),
    ).toBeNull();

    const api = productionLaunchGateResponse(
      new Request("https://ocade.in/api/ocade.chat", { method: "POST" }),
      undefined,
      launchMs - 1,
    );
    expect(api?.status).toBe(503);
    await expect(api?.json()).resolves.toMatchObject({
      status: "prelaunch",
      plannedLaunchDate: "28 August 2026",
    });

    const robots = productionLaunchGateResponse(
      new Request("https://ocade.in/robots.txt"),
      undefined,
      launchMs - 1,
    );
    expect(robots?.status).toBe(200);
    expect(await robots?.text()).toBe("User-agent: *\nDisallow: /\n");
  });

  it("publishes only the date in visible prelaunch copy", async () => {
    const response = productionLaunchGateResponse(
      new Request("https://ocade.in/"),
      { OCADE_LAUNCH_READY: "true" },
      launchMs - 1,
    );
    const body = await response?.text();
    expect(body).toContain("28 August 2026");
    expect(body).not.toContain("8:28");
    expect(body).not.toContain("02:58");
    expect(body).toContain("planned public launch");
    expect(body).not.toContain("launched on");
  });
});
