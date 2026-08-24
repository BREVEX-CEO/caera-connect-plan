/** Version shared by every OCADE source package in this release candidate. */
export const OCADE_RELEASE_VERSION = "0.1.0";

const HEALTH_PATH = "/api/health";
const LOCAL_DEPLOYMENT_ID = "local";
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
type VersionMetadataEnv = {
  CF_VERSION_METADATA?: {
    id?: unknown;
    tag?: unknown;
  };
};

type CloudflareRuntimeRequest = Request & {
  runtime?: {
    cloudflare?: {
      env?: unknown;
    };
  };
};

/**
 * Nitro attaches the native Cloudflare bindings to the augmented Request.
 * TanStack's custom server entry is invoked inside Nitro, so its second
 * argument is not guaranteed to be the platform env object.
 */
export function cloudflareRequestEnv(request: Request, env?: unknown): unknown {
  const runtimeEnv = (request as CloudflareRuntimeRequest).runtime?.cloudflare?.env;
  return runtimeEnv && typeof runtimeEnv === "object" ? runtimeEnv : env;
}

function deploymentMetadata(env: unknown): { deploymentId: string; deploymentTag?: string } {
  const metadata =
    env && typeof env === "object" ? (env as VersionMetadataEnv).CF_VERSION_METADATA : undefined;
  const deploymentId =
    typeof metadata?.id === "string" && metadata.id.length > 0 ? metadata.id : LOCAL_DEPLOYMENT_ID;
  const deploymentTag =
    typeof metadata?.tag === "string" && metadata.tag.length > 0 ? metadata.tag : undefined;
  return deploymentTag ? { deploymentId, deploymentTag } : { deploymentId };
}

export function releaseHealthResponse(request: Request, env?: unknown): Response | null {
  const url = new URL(request.url);
  if (url.pathname !== HEALTH_PATH) return null;
  const deployment = deploymentMetadata(cloudflareRequestEnv(request, env));

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(
      JSON.stringify({
        status: "method_not_allowed",
        service: "ocade-web",
        version: OCADE_RELEASE_VERSION,
        ...deployment,
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
    ...deployment,
    scope: "liveness",
  });
  return new Response(request.method === "HEAD" ? null : body, {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}
