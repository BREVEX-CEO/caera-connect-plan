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

  it("preserves a stricter route-specific content security policy", () => {
    const response = withPublicSecurityHeaders(
      new Response(null, { headers: { "content-security-policy": "default-src 'none'" } }),
    );
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'");
  });
});
