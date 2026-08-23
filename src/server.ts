import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { releaseHealthResponse } from "./lib/release-health";
import { evaluateLaunchGate } from "./lib/launch/launch-window";
import {
  PRELAUNCH_PUBLIC_ASSET_PATHS,
  prelaunchResponse,
} from "./lib/launch/prelaunch-response";
import { withPublicSecurityHeaders } from "./lib/security/public-response";
import offlineShellHtml from "../public/offline.html?raw";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Health stays available for deployment verification in every state. It
    // reports only service name, version and liveness — never the launch time.
    const health = releaseHealthResponse(request);
    if (health) return withPublicSecurityHeaders(health);

    // The launch gate runs before the application is even imported, so no
    // route, API or static application asset can be served while locked. The
    // clock used here is the server/edge clock; the browser clock is never
    // consulted, and time alone is not enough — readiness must also be set.
    const url = new URL(request.url);
    const gate = evaluateLaunchGate({
      now: Date.now(),
      hostname: url.hostname,
      env: env as Record<string, unknown> | null,
    });
    /*
     * ONE EXCEPTION: the payment webhook.
     *
     * The payment provider has no idea the product is pre-launch. If its
     * signed notifications get a locked page, it retries for three days and
     * then drops the event — a customer who paid, permanently without access,
     * with no record anywhere. This path is not a hole in the gate: it renders
     * no UI, requires a valid provider signature, and can only write
     * subscription rows.
     */
    const isPaymentWebhook = url.pathname === "/api/public/payments/webhook";
    const isPublicPrelaunchAsset =
      (request.method === "GET" || request.method === "HEAD") &&
      PRELAUNCH_PUBLIC_ASSET_PATHS.has(url.pathname);
    if (!gate.open && !isPaymentWebhook && !isPublicPrelaunchAsset) {
      return withPublicSecurityHeaders(prelaunchResponse(url.pathname, gate));
    }

    /*
     * TanStack canonicalizes unknown *.html routes by redirecting
     * /offline.html to /offline. The latter is not an application route, so the
     * service worker's REQUIRED_PRECACHE saw a 307 followed by a 404 and could
     * fail installation. This exact, non-sensitive source file is bundled into
     * the Worker and returned only after the gate is open. It cannot depend on
     * env.ASSETS here because TanStack's custom server entry does not receive
     * Cloudflare bindings as its second argument.
     */
    if (
      gate.open &&
      (request.method === "GET" || request.method === "HEAD") &&
      url.pathname === "/offline.html"
    ) {
      return withPublicSecurityHeaders(
        new Response(request.method === "HEAD" ? null : offlineShellHtml, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        }),
      );
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withPublicSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withPublicSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
