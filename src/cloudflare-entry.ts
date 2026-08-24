import "#nitro/virtual/polyfills";

import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import { useNitroApp as getNitroApp, useNitroHooks as getNitroHooks } from "nitro/app";

import { evaluateLaunchGate } from "./lib/launch/launch-window";
import { PRELAUNCH_PUBLIC_ASSET_PATHS, prelaunchResponse } from "./lib/launch/prelaunch-response";
import { withPublicSecurityHeaders } from "./lib/security/public-response";

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

function publicAssetResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", "index, follow, max-image-preview:large");
  headers.set("x-ocade-launch-state", "prelaunch-public-information");
  return withPublicSecurityHeaders(
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  );
}

function lockedAssetResponse(
  pathname: string,
  gate: ReturnType<typeof evaluateLaunchGate>,
): Response {
  const response = prelaunchResponse(pathname, gate);
  const headers = new Headers(response.headers);
  headers.set("x-ocade-edge-gate", "asset-v1");
  return withPublicSecurityHeaders(
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  );
}

/**
 * Outermost Cloudflare entrypoint.
 *
 * Nitro's stock Cloudflare adapter forwards matching public files to ASSETS
 * before the TanStack server entry runs. That is normally a useful fast path,
 * but it would bypass OCADE's pre-launch gate for hashed application bundles.
 * This entry owns that decision at the actual edge boundary: only the two
 * factual brand images may pass while locked; every other uploaded asset gets
 * the same 503/no-store/noindex response as a private page.
 */
export default {
  async fetch(request: Request, env: CloudflareEnvironment, context: WaitUntilContext) {
    setGlobalEnvironment(env);
    augmentRequest(request, env, context);

    const url = new URL(request.url);
    if (env.ASSETS && isPublicAssetURL(url.pathname)) {
      const gate = evaluateLaunchGate({
        now: Date.now(),
        hostname: url.hostname,
        env,
      });
      const mayReadPublicAsset =
        (request.method === "GET" || request.method === "HEAD") &&
        PRELAUNCH_PUBLIC_ASSET_PATHS.has(url.pathname);

      if (!gate.open && !mayReadPublicAsset) {
        return lockedAssetResponse(url.pathname, gate);
      }

      const response = await env.ASSETS.fetch(request);
      return gate.open ? withPublicSecurityHeaders(response) : publicAssetResponse(response);
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
      nitroHooks.callHook("cloudflare:scheduled", { controller, env, context }) ??
        Promise.resolve(),
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
