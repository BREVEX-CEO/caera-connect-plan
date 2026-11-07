import { renderErrorPage } from "./lib/error-page";
import { cloudflareRequestEnv, releaseHealthResponse } from "./lib/health";
import { readBoundedRequestText } from "./lib/read-bounded-request";
import { buildHealthRecord } from "./lib/telemetry/operation-health";
import { AsyncLocalStorage } from "node:async_hooks";
import { newNonce, setRequestNonceSource } from "./lib/security/csp-nonce";
import { withPublicSecurityHeaders } from "./lib/security/public-response";
import offlineShellHtml from "../public/offline.html?raw";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

/** One random CSP nonce per rendered request; the router reads it when it is created. */
const requestNonces = new AsyncLocalStorage<string>();
setRequestNonceSource(() => requestNonces.getStore());

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
async function normalizeCatastrophicSsrResponse(
  response: Response,
  started: number,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  if (!response.body) return response;
  const body = await readBoundedRequestText(response.clone(), 2_048);
  if (body === null || !isH3SwallowedErrorBody(body)) return response;

  recordSsrFailure(started);
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function recordSsrFailure(started: number): void {
  console.error(
    buildHealthRecord({
      component: "web",
      operation: "ssr",
      outcome: "failed",
      errorClass: "internal",
      durationMs: performance.now() - started,
    }),
  );
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
    const runtimeEnv = cloudflareRequestEnv(request, env);
    // Health stays available for deployment verification in every state. It
    // reports only service name, version and liveness.
    const health = releaseHealthResponse(request, runtimeEnv);
    if (health) return withPublicSecurityHeaders(health, new URL(request.url).pathname);

    const url = new URL(request.url);

    /*
     * TanStack canonicalizes unknown *.html routes by redirecting
     * /offline.html to /offline. The latter is not an application route, so the
     * service worker's REQUIRED_PRECACHE saw a 307 followed by a 404 and could
     * fail installation. This exact, non-sensitive source file is bundled into
     * the Worker. It cannot depend on env.ASSETS here because TanStack's custom
     * server entry does not receive Cloudflare bindings as its second
     * argument.
     */
    if (
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
        url.pathname,
      );
    }

    const started = performance.now();
    const nonce = newNonce();
    try {
      const handler = await getServerEntry();
      const response = await requestNonces.run(nonce, () => handler.fetch(request, env, ctx));
      return withPublicSecurityHeaders(
        await normalizeCatastrophicSsrResponse(response, started),
        url.pathname,
        nonce,
      );
    } catch {
      recordSsrFailure(started);
      return withPublicSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        url.pathname,
      );
    }
  },
};
