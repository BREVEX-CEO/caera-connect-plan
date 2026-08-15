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
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss: blob:",
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const DEFAULT_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy": APP_CSP,
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
