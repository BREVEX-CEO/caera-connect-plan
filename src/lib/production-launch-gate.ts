/**
 * Production launch boundary for the public OCADE web service.
 *
 * The release is deployed before launch so it can be tested and rolled back,
 * but public Cloudflare hosts remain closed until both the fixed instant and
 * an operator-controlled readiness flag are satisfied. Local development and
 * Lovable previews are deliberately outside this boundary.
 */

export const OCADE_PUBLIC_LAUNCH_AT = "2026-08-28T02:58:00.000Z";
export const OCADE_PUBLIC_LAUNCH_DATE = "28 August 2026";

const LAUNCH_AT_MS = Date.parse(OCADE_PUBLIC_LAUNCH_AT);
const PRODUCTION_HOSTS = new Set(["ocade.in", "www.ocade.in"]);

type LaunchEnvironment = Record<string, unknown> | null | undefined;

function isCloudflarePreviewHost(hostname: string) {
  return hostname.endsWith(".workers.dev") || hostname.endsWith(".pages.dev");
}

function isLaunchProtectedHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return PRODUCTION_HOSTS.has(normalized) || isCloudflarePreviewHost(normalized);
}

function isReady(environment: LaunchEnvironment) {
  return environment?.OCADE_LAUNCH_READY === "true";
}

function commonHeaders(contentType: string) {
  return {
    "cache-control": "no-store, max-age=0",
    "content-security-policy":
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "content-type": contentType,
    "cross-origin-resource-policy": "same-origin",
    "referrer-policy": "no-referrer",
    "retry-after": "3600",
    "x-content-type-options": "nosniff",
    "x-ocade-launch-state": "prelaunch",
    "x-robots-tag": "noindex, nofollow, noarchive, nosnippet",
  };
}

function prelaunchHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
  <title>OCADE - Planned launch</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #090909; color: #f7f7f2; }
    main { width: min(620px, 100%); border: 1px solid #2c2c2a; border-radius: 24px; padding: clamp(32px, 7vw, 64px); background: #11110f; box-shadow: 0 24px 80px #0008; }
    p { color: #b9b9b0; line-height: 1.65; }
    .eyebrow { color: #d6ad5c; font-size: 12px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
    h1 { margin: 14px 0 12px; font-size: clamp(42px, 10vw, 72px); letter-spacing: -.05em; }
    strong { color: #f7f7f2; }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">CAERA CADANE</div>
    <h1>OCADE</h1>
    <p>OCADE is preparing for its planned public launch on <strong>${OCADE_PUBLIC_LAUNCH_DATE}</strong>.</p>
    <p>Founded by Haans Antoni in Bengaluru, Karnataka, India.</p>
  </main>
</body>
</html>`;
}

/**
 * Returns a blocking response while production is prelaunch, otherwise null.
 * The health endpoint stays reachable so the release can be independently
 * verified without exposing the application.
 */
export function productionLaunchGateResponse(
  request: Request,
  environment: LaunchEnvironment,
  nowMs = Date.now(),
): Response | null {
  const url = new URL(request.url);
  if (!isLaunchProtectedHost(url.hostname) || url.pathname === "/api/health") return null;

  if (isReady(environment) && nowMs >= LAUNCH_AT_MS) return null;

  if (url.pathname === "/robots.txt") {
    const body = "User-agent: *\nDisallow: /\n";
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: commonHeaders("text/plain; charset=utf-8"),
    });
  }

  if (url.pathname.startsWith("/api/") || (request.method !== "GET" && request.method !== "HEAD")) {
    const body = JSON.stringify({
      status: "prelaunch",
      plannedLaunchDate: OCADE_PUBLIC_LAUNCH_DATE,
    });
    return new Response(request.method === "HEAD" ? null : body, {
      status: 503,
      headers: commonHeaders("application/json; charset=utf-8"),
    });
  }

  return new Response(request.method === "HEAD" ? null : prelaunchHtml(), {
    status: 503,
    headers: commonHeaders("text/html; charset=utf-8"),
  });
}
