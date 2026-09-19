import { isolationHeadersFor } from "./isolation";
import { getSupabaseBrowserConfiguration } from "@/integrations/supabase/configuration";

/**
 * Browser-facing response hardening shared by the launch gate and application.
 *
 * This reduces the blast radius of common injection, framing and permission
 * mistakes. It does not—and must never claim to—disable developer tools or
 * make client code impossible to inspect. Product secrets belong server-side.
 */
function appCsp(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: " +
      "https://static.cloudflareinsights.com/beacon.min.js " +
      "https://static.cloudflareinsights.com/beacon.min.js/",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    /*
     * EVERY HTTPS HOST ON THE INTERNET WAS A PERMITTED DESTINATION.
     *
     * `connect-src 'self' https: wss:` means that any script which ever runs on
     * this page may POST anywhere. No injection has been found — the model's
     * output is escaped by `react-markdown` and there is no raw-HTML renderer —
     * but the value of a policy is what it costs an injection that has not been
     * found yet, and this one cost nothing. A conversation, a Library file or a
     * session could have left for an arbitrary host with the page's own
     * permission.
     *
     * WHAT IS LEFT IS WHAT OCADE ACTUALLY TALKS TO: itself, the configured
     * Supabase project (its REST, Auth, Storage, Functions and its realtime
     * socket), and Cloudflare's analytics beacon. The model artifact is same
     * origin — `/api/offline/bytes/...`, signed per request — so it needs no
     * source of its own.
     *
     * THE SUPABASE ORIGIN IS READ FROM CONFIGURATION, not written here, because
     * it differs between the production project and the loopback stub the browser
     * proofs run against. A deployment with no Supabase configured gets no
     * Supabase source, which is correct: there is nothing to reach.
     *
     * The loopback grants this used to carry went with the local runtime they
     * were for. Nothing probes `localhost:11434` any more — that engine, and the
     * companion bridge beside it, are gone — and a policy that still permits the
     * page to reach a person's own machine is an open door held for nobody.
     */
    connectSources(),
    "worker-src 'self' blob:",
    /*
     * NOTHING OFF-ORIGIN, AND THAT IS NOW TRUE OF THE COMPONENT TOO.
     *
     * This directive briefly named a media host, to fix a console error every
     * public page was logging: `PublicPage` requested a background video the
     * policy did not permit. Widening the policy stopped the console error and
     * started something worse — the request actually left the browser, and on any
     * network that cannot reach that host twenty public routes began failing the
     * audit's "no failing request outside loopback" check instead.
     *
     * The video is gone rather than the directive widened. A decorative layer must
     * not make a public page's health depend on somebody else's server.
     * `csp-agrees-with-prelaunch.test.ts` asserts the policy and the component
     * agree about media hosts in BOTH directions, so neither can drift again.
     */
    "media-src 'self' blob: data:",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * `connect-src`, built from what this deployment is actually configured to use.
 *
 * Both schemes of the Supabase origin are needed: realtime opens a WebSocket to
 * the same host, and a source with an `https` scheme does not cover `wss`.
 */
function connectSources(): string {
  const sources = ["'self'", "blob:", "https://cloudflareinsights.com"];
  const configured = getSupabaseBrowserConfiguration().url;
  if (configured) {
    try {
      const { origin, host, protocol } = new URL(configured);
      sources.push(origin);
      sources.push(`${protocol === "https:" ? "wss" : "ws"}://${host}`);
    } catch {
      /* An unparseable binding grants nothing, which fails closed. */
    }
  }
  return `connect-src ${sources.join(" ")}`;
}

function defaultSecurityHeaders(): Readonly<Record<string, string>> {
  return {
    "content-security-policy": appCsp(),
    /*
     * HTTPS ONLY, REMEMBERED BY THE BROWSER.
     *
     * `upgrade-insecure-requests` in the policy above rewrites subresources; it
     * does nothing about the FIRST request, which is the one an attacker on a
     * café network wants. HSTS closes that window for every visit after the
     * first: the browser refuses plain HTTP to this host for a year without
     * asking anybody.
     *
     * A year, and no `includeSubDomains`. Subdomains are a commitment about
     * hosts this code cannot see — one of them serving plain HTTP would become
     * unreachable, and undoing it means waiting out the max-age on every visitor
     * who ever received the header. No `preload` either: that is a submission to
     * a list baked into browser binaries, and it is close to irreversible.
     *
     * Ignored entirely over plain HTTP and on localhost, by specification, so it
     * costs development nothing.
     */
    "strict-transport-security": "max-age=31536000",
    "cross-origin-opener-policy": "same-origin-allow-popups",
    "cross-origin-resource-policy": "same-origin",
    "origin-agent-cluster": "?1",
    "permissions-policy":
      "camera=(self), microphone=(self), geolocation=(), payment=(self), usb=(), browsing-topics=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
}

/**
 * Preserve a response's status/body and add only headers it has not set.
 *
 * `pathname` decides cross-origin isolation, and it is the ONE header pair here
 * that overrides rather than defers. Everything else uses "set it if nobody
 * else did", which is right for a default; isolation is a routing decision, and
 * a handler that happened to emit its own COOP would otherwise silently leave
 * an inference route without threads — or, worse, leave the sign-in route with
 * them.
 *
 * Omitting `pathname` yields the non-isolated defaults, which is the safe
 * direction: a caller that forgets costs a single-threaded engine, never a
 * severed `window.opener` under a popup.
 */
export function withPublicSecurityHeaders(response: Response, pathname?: string): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(defaultSecurityHeaders())) {
    if (!headers.has(name)) headers.set(name, value);
  }

  const isolation = isolationHeadersFor(pathname ?? "/");
  headers.set("cross-origin-opener-policy", isolation["cross-origin-opener-policy"]);
  const coep = isolation["cross-origin-embedder-policy"];
  if (coep) headers.set("cross-origin-embedder-policy", coep);
  else headers.delete("cross-origin-embedder-policy");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** The exact headers this module applies, for tests and probes to assert on. */
export function securityHeadersForTest(): Readonly<Record<string, string>> {
  return defaultSecurityHeaders();
}

/**
 * ONE ORIGIN, BECAUSE A BROWSER GIVES EACH ONE ITS OWN EVERYTHING.
 *
 * `www.ocade.in` and `ocade.in` both answered 200, and they are not two names
 * for one place as far as a browser is concerned: localStorage, IndexedDB,
 * OPFS, cookies, service workers and the model vault are keyed by ORIGIN. So a
 * person who arrived at one and later at the other had two sessions, two
 * caches, and could be asked to download the 484 MB offline release a second
 * time for the same account on the same machine.
 *
 * 308 rather than 301 or 302: the method and body must survive, because a form
 * post or a server-function call that lands here has to arrive intact rather
 * than as a GET. Path and query are preserved for the same reason.
 *
 * Only `www.` is redirected. Anything else — the apex, a preview host,
 * localhost — is left exactly as it is, so development and Cloudflare's own
 * health probes are untouched.
 */
export function canonicalHostRedirect(url: URL): Response | null {
  if (!url.hostname.startsWith("www.")) return null;
  const canonical = new URL(url);
  canonical.hostname = url.hostname.slice(4);
  return new Response(null, {
    status: 308,
    headers: { location: canonical.toString(), "cache-control": "public, max-age=3600" },
  });
}
