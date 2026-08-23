import { describe, it, expect } from "vitest";
import { securityHeadersForTest, withPublicSecurityHeaders } from "../security/public-response";

/**
 * The Content-Security-Policy had no test at all, and it had a defect that
 * only a browser could show: `connect-src 'self' https: wss: blob:` forbade
 * plain HTTP to loopback, so every probe for a local model runtime was refused
 * by OCADE's own policy —
 *
 *   Refused to connect to 'http://localhost:11434/api/version' because it
 *   violates the following Content Security Policy directive: "connect-src …"
 *
 * — and the on-device engine could never be detected in a deployed build,
 * however correctly it was running. A policy nothing asserts on is a policy
 * that regresses silently, in a way no unit test notices and no reviewer reads.
 */

function directive(name: string): string {
  const csp = securityHeadersForTest()["content-security-policy"];
  const found = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));
  if (!found) throw new Error(`no ${name} directive in policy: ${csp}`);
  return found;
}

describe("the policy lets OCADE reach a model runtime on this machine", () => {
  it("allows plain HTTP to loopback, which is where a local runtime listens", () => {
    const connect = directive("connect-src");
    expect(connect).toContain("http://localhost:*");
    expect(connect).toContain("http://127.0.0.1:*");
  });

  it("allows a loopback websocket, for streaming from the same runtime", () => {
    const connect = directive("connect-src");
    expect(connect).toContain("ws://localhost:*");
    expect(connect).toContain("ws://127.0.0.1:*");
  });

  /**
   * The grant has to stay loopback. `http:` on its own, or a wildcard host,
   * would let the page reach anything on the user's network.
   */
  it("does NOT open plain HTTP generally", () => {
    const connect = directive("connect-src");
    expect(connect).not.toMatch(/(^|\s)http:(\s|$)/);
    expect(connect).not.toContain("http://*");
    expect(connect).not.toContain("ws://*");
  });

  it("uses no bracketed IPv6 literal, which is not a valid CSP source", () => {
    // Chrome discards the entire source and warns; it protects nothing.
    expect(directive("connect-src")).not.toContain("[::1]");
  });
});

describe("the rest of the policy still holds", () => {
  it.each([
    ["default-src", "'self'"],
    ["object-src", "'none'"],
    ["frame-ancestors", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
  ])("%s stays %s", (name, value) => {
    expect(directive(name)).toBe(`${name} ${value}`);
  });

  it("never allows arbitrary remote script", () => {
    const script = directive("script-src");
    expect(script).not.toMatch(/(^|\s)https:(\s|$)/);
    expect(script).not.toContain("*");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it("keeps the headers that stop framing and sniffing", () => {
    const headers = securityHeadersForTest();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});

describe("applying the headers never rewrites the response", () => {
  it("preserves status and body", async () => {
    const wrapped = withPublicSecurityHeaders(
      new Response("hello", { status: 201, statusText: "Created" }),
    );
    expect(wrapped.status).toBe(201);
    expect(await wrapped.text()).toBe("hello");
    expect(wrapped.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  it("does not override a header the response already set", () => {
    const wrapped = withPublicSecurityHeaders(
      new Response("x", { headers: { "content-security-policy": "default-src 'none'" } }),
    );
    expect(wrapped.headers.get("content-security-policy")).toBe("default-src 'none'");
  });
});
