import { describe, it, expect } from "vitest";
import { securityHeadersForTest, withPublicSecurityHeaders } from "../security/public-response";
import { getSupabaseBrowserConfiguration } from "@/integrations/supabase/configuration";

/**
 * The Content-Security-Policy had no test at all, and it had two defects that
 * only a browser or an attacker would show.
 *
 * The first was a grant it needed and did not have: `connect-src 'self' https:`
 * forbade plain HTTP to loopback, where a local model runtime listened, so
 * every probe was refused by OCADE's own policy. That runtime and the companion
 * bridge beside it are gone, and the grant went with them — a policy that still
 * permits the page to reach a person's own machine is an open door held for
 * nobody.
 *
 * The second was a grant it did not need and did have: `https: wss:` made every
 * host on the internet a permitted destination, so any future injection could
 * post a conversation, a file or a session anywhere. What is permitted now is
 * what OCADE actually talks to.
 *
 * A policy nothing asserts on is a policy that regresses silently, in a way no
 * unit test notices and no reviewer reads.
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

describe("the policy permits only the destinations OCADE actually uses", () => {
  it("does not permit every HTTPS or WSS host on the internet", () => {
    const connect = directive("connect-src");
    expect(connect).not.toMatch(/(^|\s)https:(\s|$)/);
    expect(connect).not.toMatch(/(^|\s)wss:(\s|$)/);
    expect(connect).not.toContain("*");
  });

  it("permits the configured Supabase project, over both schemes it uses", () => {
    // Realtime opens a WebSocket to the same host, and an `https` source does
    // not cover `wss` — leaving that out breaks live updates in a way that
    // looks like a server fault.
    const { url } = getSupabaseBrowserConfiguration();
    const connect = directive("connect-src");
    if (!url) {
      // Nothing configured, nothing granted. That is the fail-closed direction.
      expect(connect).toBe("connect-src 'self' blob: https://cloudflareinsights.com");
      return;
    }
    const { origin, host, protocol } = new URL(url);
    expect(connect).toContain(origin);
    expect(connect).toContain(`${protocol === "https:" ? "wss" : "ws"}://${host}`);
  });

  it("keeps the page able to reach itself and its own blobs", () => {
    const connect = directive("connect-src");
    expect(connect).toContain("'self'");
    // The offline artifact is served from this origin, and the engine reads it
    // through a blob URL.
    expect(connect).toContain("blob:");
  });

  it("no longer holds a door open to this machine", () => {
    const connect = directive("connect-src");
    expect(connect).not.toContain("http://localhost");
    expect(connect).not.toContain("http://127.0.0.1");
    expect(connect).not.toContain("ws://localhost");
  });

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

  it("allows only Cloudflare's SRI-protected analytics beacon path", () => {
    const script = directive("script-src");
    expect(script).toContain("https://static.cloudflareinsights.com/beacon.min.js");
    expect(script).toContain("https://static.cloudflareinsights.com/beacon.min.js/");
    expect(script).not.toContain("https://static.cloudflareinsights.com ");
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
