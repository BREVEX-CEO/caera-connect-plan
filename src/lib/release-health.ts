/** Version shared by every OCADE source package in this release candidate. */
export const OCADE_RELEASE_VERSION = "0.1.0";

const HEALTH_PATH = "/api/health";
const HEALTH_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
} as const;

/**
 * Dependency-free process liveness.
 *
 * This intentionally does not contact Supabase or an AI provider. A liveness
 * probe that depends on an external service can restart a healthy worker during
 * an upstream outage. Deep dependency checks belong in authenticated release
 * validation, not in a public endpoint.
 */
export function releaseHealthResponse(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.pathname !== HEALTH_PATH) return null;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(
      JSON.stringify({
        status: "method_not_allowed",
        service: "ocade-web",
        version: OCADE_RELEASE_VERSION,
      }),
      {
        status: 405,
        headers: { ...HEALTH_HEADERS, allow: "GET, HEAD" },
      },
    );
  }

  const body = JSON.stringify({
    status: "ok",
    service: "ocade-web",
    version: OCADE_RELEASE_VERSION,
    scope: "liveness",
  });
  return new Response(request.method === "HEAD" ? null : body, {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}
