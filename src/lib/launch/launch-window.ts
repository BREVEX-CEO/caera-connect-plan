/**
 * OCADE production readiness gate.
 *
 * The historical launch date constants remain exported for documentation and
 * old tooling, but the calendar no longer opens or closes the product. Public
 * availability is controlled only by an explicit human readiness flag.
 */

/** Historical planned instant; NOT used as a runtime timer/gate. */
export const LAUNCH_AT_ISO = "2026-08-28T02:58:00.000Z";
export const LAUNCH_AT_MS = Date.parse(LAUNCH_AT_ISO);
export const LAUNCH_PUBLIC_DATE_LABEL = "28 August 2026";
export const LAUNCH_READY_ENV_KEY = "OCADE_LAUNCH_READY";
export const LAUNCH_PREVIEW_ENV_KEY = "OCADE_LAUNCH_PREVIEW";

export type LaunchGateDecision = {
  open: boolean;
  reason:
    | "open_launched"
    | "open_internal_preview"
    | "locked_before_launch"
    | "locked_not_ready";
  internal: boolean;
  retryAfterSeconds: number;
};

export type LaunchEnvLike = Record<string, unknown> | undefined | null;

function readEnv(env: LaunchEnvLike, key: string): string | undefined {
  const fromEnv = env && typeof env === "object" ? (env as Record<string, unknown>)[key] : undefined;
  if (typeof fromEnv === "string") return fromEnv;
  const proc = typeof process !== "undefined" ? process.env : undefined;
  const fromProcess = proc?.[key];
  return typeof fromProcess === "string" ? fromProcess : undefined;
}

function isTrue(value: string | undefined): boolean {
  return value === "true";
}

export function isInternalHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") {
    return true;
  }
  if (host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host.endsWith(".lovableproject.com")) return true;
  if (host.startsWith("id-preview--") && host.endsWith(".lovable.app")) return true;
  if (host.endsWith("-dev.lovable.app")) return true;
  return false;
}

export function isLaunchReady(env: LaunchEnvLike): boolean {
  return isTrue(readEnv(env, LAUNCH_READY_ENV_KEY));
}

/**
 * Decide whether the shipping application may be served.
 *
 * `now` is retained in the signature for compatibility, but intentionally does
 * not participate in the decision. A date must never launch an unready build or
 * lock a ready one. Preview-domain bypasses are disabled in production unless
 * OCADE_LAUNCH_PREVIEW=true, so an attacker-controlled Host header cannot turn
 * a production request into an internal preview.
 */
export function evaluateLaunchGate(options: {
  now: Date | number;
  hostname: string;
  env?: LaunchEnvLike;
}): LaunchGateDecision {
  const { hostname, env } = options;
  const explicitPreview = isTrue(readEnv(env, LAUNCH_PREVIEW_ENV_KEY));
  const nodeEnv = readEnv(env, "NODE_ENV");
  const internalHostPreview = nodeEnv !== "production" && isInternalHost(hostname);
  const internal = explicitPreview || internalHostPreview;

  if (internal) {
    return { open: true, reason: "open_internal_preview", internal: true, retryAfterSeconds: 0 };
  }

  if (!isLaunchReady(env)) {
    return {
      open: false,
      reason: "locked_not_ready",
      internal: false,
      retryAfterSeconds: 300,
    };
  }

  return { open: true, reason: "open_launched", internal: false, retryAfterSeconds: 0 };
}
