import { describe, expect, it } from "vitest";
import { withPublicSecurityHeaders } from "@/lib/security/public-response";

describe("public response security headers", () => {
  it("hardens an application response without changing its body or status", async () => {
    const response = withPublicSecurityHeaders(
      new Response("OCADE", { status: 202, headers: { "x-ocade-test": "kept" } }),
    );

    expect(response.status).toBe(202);
    expect(await response.text()).toBe("OCADE");
    expect(response.headers.get("x-ocade-test")).toBe("kept");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("permissions-policy")).toContain("geolocation=()");
    expect(response.headers.get("content-security-policy")).toContain("object-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("tells the browser to refuse plain HTTP to this host in future", () => {
    const response = withPublicSecurityHeaders(new Response(null));
    const hsts = response.headers.get("strict-transport-security");
    expect(hsts).toMatch(/max-age=\d+/);
    // A year. Shorter and a returning visitor is exposed again too soon.
    expect(Number(/max-age=(\d+)/.exec(hsts ?? "")?.[1] ?? 0)).toBeGreaterThanOrEqual(31_536_000);
    /*
     * Deliberately absent, and this is the test that keeps them absent:
     * `includeSubDomains` is a promise about hosts this repository cannot see,
     * and `preload` is a submission to a list compiled into browser binaries.
     * Both are close to irreversible on the timescale of a mistake.
     */
    expect(hsts).not.toContain("includeSubDomains");
    expect(hsts).not.toContain("preload");
  });

  it("names every header it sets, so the list cannot drift from the test", () => {
    const response = withPublicSecurityHeaders(new Response(null));
    for (const header of [
      "content-security-policy",
      "strict-transport-security",
      "cross-origin-opener-policy",
      "cross-origin-resource-policy",
      "origin-agent-cluster",
      "permissions-policy",
      "referrer-policy",
      "x-content-type-options",
      "x-frame-options",
    ]) {
      expect(response.headers.get(header), `${header} was not set`).toBeTruthy();
    }
  });

  it("preserves a stricter route-specific content security policy", () => {
    const response = withPublicSecurityHeaders(
      new Response(null, { headers: { "content-security-policy": "default-src 'none'" } }),
    );
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'");
  });
});
