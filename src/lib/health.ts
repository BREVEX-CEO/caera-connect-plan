import { OCADE_COMMIT, OCADE_RELEASE_VERSION } from "./release";

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
  SUPABASE_URL?: unknown;
  SUPABASE_PUBLISHABLE_KEY?: unknown;
  SUPABASE_SERVICE_ROLE_KEY?: unknown;
  OCADE_MODELS?: unknown;
  OCADE_LEASE_SIGNING_KEY_ID?: unknown;
  OCADE_LEASE_SIGNING_PRIVATE_KEY?: unknown;
  OCADE_LEASE_SIGNING_PUBLIC_KEY?: unknown;
  OCADE_LEASE_SIGNING_NOT_BEFORE?: unknown;
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

/**
 * WHICH BINDINGS EXIST, NEVER WHAT THEY CONTAIN.
 *
 * `supabaseServer` is here because its absence is invisible and total. A
 * deployment missing the service-role secret serves the shell, signs people in
 * and renders Chat — and then every server function that needs the admin client
 * throws: the allowance permit ("OCADE could not verify your usage allowance"),
 * the Billing read, the session list, and the Offline release, which reports
 * itself unavailable although the artifact exists. All four were live at once,
 * and the release gate passed the whole time because it only asked about the
 * two public values the browser also holds.
 *
 * Booleans only. The endpoint is public, so it may say that a secret is
 * configured and must never say anything about its value.
 */
function configurationMetadata(env: unknown): {
  supabasePublic: boolean;
  supabaseServer: boolean;
  modelDelivery: boolean;
  offlineLeases: boolean;
} {
  const runtime = env && typeof env === "object" ? (env as VersionMetadataEnv) : undefined;
  const present = (value: unknown): boolean => typeof value === "string" && value.length > 0;
  return {
    supabasePublic: present(runtime?.SUPABASE_URL) && present(runtime?.SUPABASE_PUBLISHABLE_KEY),
    supabaseServer: present(runtime?.SUPABASE_SERVICE_ROLE_KEY),
    /*
     * The private bucket binding, without which the only door to the artifact
     * answers 503 and Offline Intelligence can never finish installing.
     * An object, not a string, so it is checked as one.
     */
    modelDelivery: Boolean(runtime?.OCADE_MODELS) && typeof runtime?.OCADE_MODELS === "object",
    /*
     * All four values the signing authority requires. Three of four is the
     * same as none: `loadOfflineLeaseSigningAuthority` refuses rather than
     * inventing a key, so offline capacity cannot be issued at all.
     *
     * Presence is not correctness — a mismatched key pair still fails the
     * authority's own sign-and-verify probe at issue time. What this answers is
     * the question a release gate can ask from outside: is anything missing?
     */
    offlineLeases:
      present(runtime?.OCADE_LEASE_SIGNING_KEY_ID) &&
      present(runtime?.OCADE_LEASE_SIGNING_PRIVATE_KEY) &&
      present(runtime?.OCADE_LEASE_SIGNING_PUBLIC_KEY) &&
      present(runtime?.OCADE_LEASE_SIGNING_NOT_BEFORE),
  };
}

export function releaseHealthResponse(request: Request, env?: unknown): Response | null {
  const url = new URL(request.url);
  if (url.pathname !== HEALTH_PATH) return null;
  const deployment = deploymentMetadata(cloudflareRequestEnv(request, env));
  const configuration = configurationMetadata(cloudflareRequestEnv(request, env));

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(
      JSON.stringify({
        status: "method_not_allowed",
        service: "ocade-web",
        version: OCADE_RELEASE_VERSION,
        ...deployment,
        configuration,
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
    commit: OCADE_COMMIT,
    ...deployment,
    configuration,
    scope: "liveness",
  });
  return new Response(request.method === "HEAD" ? null : body, {
    status: 200,
    headers: HEALTH_HEADERS,
  });
}
