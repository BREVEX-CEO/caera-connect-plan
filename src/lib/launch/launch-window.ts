/**
 * Canonical OCADE production launch window.
 *
 * One module owns the launch instant. Everything else — the edge gate, robots,
 * sitemap, runbook checks and tests — reads it from here so the date can never
 * drift between the worker and the documentation.
 *
 * Two independent conditions must both hold before the production product is
 * reachable:
 *
 *   1. Server/edge time is at or after `LAUNCH_AT_ISO`.
 *   2. An explicit server-side readiness flag (`OCADE_LAUNCH_READY=true`) is set
 *      by a human after the real pre-launch checks passed.
 *
 * The clock alone never launches anything: an unready release stays locked
 * rather than opening broken. The browser clock is never consulted.
 */

import { COMPANY_FACTS } from "@/config/company-facts";

/** Exact launch instant. 28 August 2026, 08:28:00 IST. */
export const LAUNCH_AT_ISO = COMPANY_FACTS.launchAtIso;

/** Milliseconds since epoch for `LAUNCH_AT_ISO`. */
export const LAUNCH_AT_MS = Date.parse(LAUNCH_AT_ISO);

/**
 * The only launch wording allowed in public copy, metadata or structured data.
 * The exact time of day is deliberately absent.
 */
export const LAUNCH_PUBLIC_DATE_LABEL = COMPANY_FACTS.foundingDateLabel;

/** Environment variable that carries the human-set production readiness flag. */
export const LAUNCH_READY_ENV_KEY = "OCADE_LAUNCH_READY";

/** Environment variable that marks a non-production (internal) deployment. */
export const LAUNCH_PREVIEW_ENV_KEY = "OCADE_LAUNCH_PREVIEW";

export type LaunchGateDecision = {
  /** True when the shipping application may be served. */
  open: boolean;
  /** Machine-readable reason, safe to log. Never contains the launch time. */
  reason: "open_launched" | "open_internal_preview" | "locked_before_launch" | "locked_not_ready";
  /** True when this request came from an approved internal/dev origin. */
  internal: boolean;
  /** Seconds a client should wait before retrying, when locked. */
  retryAfterSeconds: number;
};

export type LaunchEnvLike = Record<string, unknown> | undefined | null;

function readEnv(env: LaunchEnvLike, key: string): string | undefined {
  const fromEnv =
    env && typeof env === "object" ? (env as Record<string, unknown>)[key] : undefined;
  if (typeof fromEnv === "string") return fromEnv;
  const proc = typeof process !== "undefined" ? process.env : undefined;
  const fromProcess = proc?.[key];
  return typeof fromProcess === "string" ? fromProcess : undefined;
}

function isTrue(value: string | undefined): boolean {
  return value === "true";
}

/**
 * Hosts that are development or approved internal preview surfaces. These stay
 * testable before launch; none of them is the production product.
 */
export function isInternalHost(hostname: string): boolean {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
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
 * Decide whether the shipping application may be served for this request.
 *
 * `now` must come from the server/edge clock.
 */
export function evaluateLaunchGate(options: {
  now: Date | number;
  hostname: string;
  env?: LaunchEnvLike;
}): LaunchGateDecision {
  const { hostname, env } = options;
  const nowMs = typeof options.now === "number" ? options.now : options.now.getTime();

  const internal = isInternalHost(hostname) || isTrue(readEnv(env, LAUNCH_PREVIEW_ENV_KEY));
  if (internal) {
    return { open: true, reason: "open_internal_preview", internal: true, retryAfterSeconds: 0 };
  }

  if (nowMs < LAUNCH_AT_MS) {
    const remaining = Math.ceil((LAUNCH_AT_MS - nowMs) / 1000);
    return {
      open: false,
      reason: "locked_before_launch",
      internal: false,
      // Capped so the response never discloses the exact launch instant.
      retryAfterSeconds: Math.min(Math.max(remaining, 60), 3600),
    };
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
