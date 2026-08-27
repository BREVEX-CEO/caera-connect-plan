/**
 * Browser-facing response hardening shared by the launch gate and application.
 *
 * This reduces the blast radius of common injection, framing and permission
 * mistakes. It does not—and must never claim to—disable developer tools or
 * make client code impossible to inspect. Product secrets belong server-side.
 */
const APP_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: " +
    "https://static.cloudflareinsights.com/beacon.min.js " +
    "https://static.cloudflareinsights.com/beacon.min.js/",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  /*
   * Loopback is allowed, and it has to be.
   *
   * OCADE's whole point is that inference can run on the user's own machine,
   * and a local runtime — Ollama, and the companion bridge — listens on plain
   * HTTP at 127.0.0.1. `connect-src 'self' https:` forbade exactly that, so
   * every local-model probe the product makes was refused by the app's own
   * policy: "Refused to connect to 'http://localhost:11434/api/version'".
   * The local engine could never be detected in a deployed build, however
   * correctly it was running.
   *
   * Loopback ONLY. This grants nothing on the network — no other http origin
   * is permitted, and the wildcard is on the port rather than the host, so it
   * cannot be widened to a LAN address. `upgrade-insecure-requests` below does
   * not rewrite these: localhost and 127.0.0.1 are potentially-trustworthy
   * origins and are exempt from the upgrade by specification.
   *
   * No `http://[::1]:*`: a bracketed IPv6 literal is not a valid CSP
   * host-source, and Chrome discards the whole source with a console warning.
   * The product addresses its local runtime as localhost or 127.0.0.1, both of
   * which are covered.
   */
  "connect-src 'self' https: wss: blob: " +
    "http://localhost:* http://127.0.0.1:* " +
    "ws://localhost:* ws://127.0.0.1:*",
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const DEFAULT_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy": APP_CSP,
  /*
   * HTTPS ONLY, REMEMBERED BY THE BROWSER.
   *
   * `upgrade-insecure-requests` in the policy above rewrites subresources; it
   * does nothing about the FIRST request, which is the one an attacker on a
   * café network wants. HSTS closes that window for every visit after the
   * first: the browser refuses plain HTTP to this host for a year without
   * asking anybody.
   *
   * A year, and no `includeSubDomains`. Subdomains are a commitment about
   * hosts this code cannot see — one of them serving plain HTTP would become
   * unreachable, and undoing it means waiting out the max-age on every visitor
   * who ever received the header. No `preload` either: that is a submission to
   * a list baked into browser binaries, and it is close to irreversible.
   *
   * Ignored entirely over plain HTTP and on localhost, by specification, so it
   * costs development nothing.
   */
  "strict-transport-security": "max-age=31536000",
  "cross-origin-opener-policy": "same-origin-allow-popups",
  "cross-origin-resource-policy": "same-origin",
  "origin-agent-cluster": "?1",
  "permissions-policy":
    "camera=(self), microphone=(self), geolocation=(), payment=(self), usb=(), browsing-topics=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

/** Preserve a response's status/body and add only headers it has not set. */
export function withPublicSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** The exact headers this module applies, for tests and probes to assert on. */
export function securityHeadersForTest(): Readonly<Record<string, string>> {
  return DEFAULT_SECURITY_HEADERS;
}
