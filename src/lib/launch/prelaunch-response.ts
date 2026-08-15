/**
 * Pre-launch edge responses.
 *
 * Before the production product is open, the worker answers every public
 * request itself. No application JavaScript, no static application bundle and
 * no app API is reachable. Only two paths stay available:
 *
 *   /api/health  — deployment verification (handled before this module)
 *   /robots.txt  — a disallow-all directive so nothing is indexed early
 *
 * The exact launch time never appears in any response body or header; only the
 * public date label does.
 */

import { LAUNCH_PUBLIC_DATE_LABEL, type LaunchGateDecision } from "./launch-window";

/** Paths the edge gate may answer while the product is locked. */
export const PRELAUNCH_ALLOWED_PATHS = new Set(["/robots.txt"]);

const NOINDEX = "noindex, nofollow, noarchive";

function lockedHeaders(decision: LaunchGateDecision, contentType: string): HeadersInit {
  return {
    "content-type": contentType,
    "cache-control": "no-store",
    "content-security-policy":
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "cross-origin-resource-policy": "same-origin",
    "referrer-policy": "no-referrer",
    "x-robots-tag": NOINDEX,
    "retry-after": String(decision.retryAfterSeconds),
    "x-content-type-options": "nosniff",
    "x-ocade-launch-state": "prelaunch",
  };
}

/** Minimal, dependency-free pre-launch page. Contains no application script. */
export function renderPrelaunchPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="${NOINDEX}" />
    <title>CAERA CADANE — OCADE</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #08090b;
        color: #e6e8ec;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        padding: 2rem;
      }
      main {
        max-width: 32rem;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 0.75rem;
        background: rgba(255, 255, 255, 0.02);
        padding: 3rem 2rem;
      }
      .brand {
        font-size: 0.75rem;
        letter-spacing: 0.32em;
        text-transform: uppercase;
        color: #9aa3af;
      }
      h1 { margin: 1.25rem 0 0; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.01em; }
      p { margin: 1rem 0 0; color: #9aa3af; line-height: 1.7; font-size: 0.95rem; }
    </style>
  </head>
  <body>
    <main>
      <p class="brand">CAERA CADANE</p>
      <h1>OCADE</h1>
      <p>Planned launch ${LAUNCH_PUBLIC_DATE_LABEL}</p>
    </main>
  </body>
</html>
`;
}

/** Disallow-all robots directive served while the product is locked. */
export function prelaunchRobotsResponse(decision: LaunchGateDecision): Response {
  const body = ["User-agent: *", "Disallow: /", ""].join("\n");
  return new Response(body, {
    status: 200,
    headers: lockedHeaders(decision, "text/plain; charset=utf-8"),
  });
}

/**
 * The response for any locked request. `503 + Retry-After` for page and asset
 * requests; `/robots.txt` keeps a crawlable 200 disallow-all directive so
 * crawlers record the rule instead of retrying an error.
 */
export function prelaunchResponse(pathname: string, decision: LaunchGateDecision): Response {
  if (PRELAUNCH_ALLOWED_PATHS.has(pathname)) return prelaunchRobotsResponse(decision);
  return new Response(renderPrelaunchPage(), {
    status: 503,
    headers: lockedHeaders(decision, "text/html; charset=utf-8"),
  });
}
