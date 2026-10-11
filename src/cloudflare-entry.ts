import "#nitro/virtual/polyfills";

import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import { useNitroApp as getNitroApp, useNitroHooks as getNitroHooks } from "nitro/app";

import { canonicalOriginRedirect, withPublicSecurityHeaders } from "./lib/security/public-response";

/** One bounded batch a minute: file deletions still owed, also for accounts already erased. */
async function runErasureSweep(): Promise<void> {
  try {
    const { sweepTombstones } = await import("./lib/library/tombstones.server");
    const { pending, deadLetters } = await sweepTombstones(null, 1);
    if (pending !== 0) console.warn("erasure.pending", pending);
    if (deadLetters !== 0) console.warn("erasure.dead_letters", deadLetters);
  } catch (error) {
    console.error("erasure.sweep", error instanceof Error ? error.message : "failed");
  }
}

async function runJarvisClock(): Promise<void> {
  try {
    const { supabaseAdmin } = await import("./integrations/supabase/client.server");
    const { runDueSchedules } = await import("./jarvis/schedules.server");
    await runDueSchedules(supabaseAdmin);
  } catch (error) {
    // Kept to the Worker's own log; the next minute tries again.
    console.error("jarvis.schedules", error instanceof Error ? error.message : "failed");
  }
}

type WaitUntilContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type AssetBinding = {
  fetch(request: Request): Promise<Response> | Response;
};

type CloudflareEnvironment = Record<string, unknown> & {
  ASSETS?: AssetBinding;
};

type RuntimeRequest = Request & {
  ip?: string;
  runtime?: {
    name?: string;
    cloudflare?: {
      env?: CloudflareEnvironment;
      context?: WaitUntilContext;
    };
  };
  waitUntil?: WaitUntilContext["waitUntil"];
};

type ScheduledController = { cron: string };

const nitroApp = getNitroApp();
const nitroHooks = getNitroHooks();

function setGlobalEnvironment(env: CloudflareEnvironment): void {
  (globalThis as typeof globalThis & { __env__?: CloudflareEnvironment }).__env__ = env;
}

function augmentRequest(
  request: Request,
  env: CloudflareEnvironment,
  context: WaitUntilContext,
): void {
  const runtimeRequest = request as RuntimeRequest;
  runtimeRequest.ip = request.headers.get("cf-connecting-ip") ?? undefined;
  runtimeRequest.runtime ??= { name: "cloudflare" };
  runtimeRequest.runtime.cloudflare = {
    ...runtimeRequest.runtime.cloudflare,
    env,
    context,
  };
  runtimeRequest.waitUntil = context.waitUntil.bind(context);
}

/**
 * Outermost Cloudflare entrypoint.
 *
 * It answers static assets from the ASSETS binding and hands everything else to
 * Nitro. It used to hold a launch gate in front of both, which answered every
 * public request with a pre-launch page until a date and a readiness flag
 * agreed. The product is launched; a gate that is permanently open is a branch
 * nobody exercises and a second place that decides what the public may see.
 */

/**
 * Cache headers for a self-hosted model artifact.
 *
 * WHY THIS IS WORTH A SPECIAL CASE. These files are the largest thing OCADE
 * ever serves and the one a first run waits on, so every re-fetch of one is a
 * visitor waiting again for bytes they already paid for. They are also the
 * safest possible thing to cache forever: the path carries the version, the
 * bytes are content-addressed by a committed digest, and a different engine is
 * a different path by construction. So `immutable` here is not optimism — a
 * cached copy CANNOT be stale, because a change produces a new URL.
 *
 * `accept-ranges` is asserted because resumability depends on it. The chunked
 * transfer asks for ranges and falls back to a whole-file stream when a server
 * will not honour them; that fallback works, and it throws away an interrupted
 * transfer's progress, so a deployment serving its own weights should never be
 * the reason it is taken.
 *
 * Only GET and HEAD responses that actually succeeded are touched. A 404 or a
 * redirect cached for a year would be considerably worse than no caching.
 */
function withModelArtifactHeaders(pathname: string, response: Response): Response {
  if (!pathname.startsWith("/models/")) return response;
  if (response.status !== 200 && response.status !== 206) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: CloudflareEnvironment, context: WaitUntilContext) {
    setGlobalEnvironment(env);
    augmentRequest(request, env, context);

    const url = new URL(request.url);

    // Before assets and before Nitro: neither should ever serve the second
    // origin or plain HTTP, not even a static file with a cache header on it.
    const canonical = canonicalOriginRedirect(url, request.headers);
    if (canonical) return canonical;

    if (env.ASSETS && isPublicAssetURL(url.pathname)) {
      const response = await env.ASSETS.fetch(request);
      return withPublicSecurityHeaders(
        withModelArtifactHeaders(url.pathname, response),
        url.pathname,
      );
    }

    return nitroApp.fetch(request);
  },

  scheduled(
    controller: ScheduledController,
    env: CloudflareEnvironment,
    context: WaitUntilContext,
  ) {
    setGlobalEnvironment(env);
    context.waitUntil(
      Promise.all([
        nitroHooks.callHook("cloudflare:scheduled", { controller, env, context }) ??
          Promise.resolve(),
        // Every minute: JARVIS reminders and scheduled work that are due.
        runJarvisClock(),
        runErasureSweep(),
      ]),
    );
  },

  email(message: unknown, env: CloudflareEnvironment, context: WaitUntilContext) {
    setGlobalEnvironment(env);
    context.waitUntil(
      nitroHooks.callHook("cloudflare:email", { message, event: message, env, context }) ??
        Promise.resolve(),
    );
  },

  queue(batch: unknown, env: CloudflareEnvironment, context: WaitUntilContext) {
    setGlobalEnvironment(env);
    context.waitUntil(
      nitroHooks.callHook("cloudflare:queue", { batch, event: batch, env, context }) ??
        Promise.resolve(),
    );
  },

  tail(traces: unknown, env: CloudflareEnvironment, context: WaitUntilContext) {
    setGlobalEnvironment(env);
    context.waitUntil(
      nitroHooks.callHook("cloudflare:tail", { traces: traces as never[], env, context }) ??
        Promise.resolve(),
    );
  },

  trace(traces: unknown, env: CloudflareEnvironment, context: WaitUntilContext) {
    setGlobalEnvironment(env);
    context.waitUntil(
      nitroHooks.callHook("cloudflare:trace", { traces: traces as never[], env, context }) ??
        Promise.resolve(),
    );
  },
};
