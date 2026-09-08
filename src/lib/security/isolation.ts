/**
 * Cross-origin isolation, on the routes that need it and nowhere else.
 *
 * WHAT ISOLATION BUYS AND WHAT IT COSTS.
 *
 * `SharedArrayBuffer` — and therefore multi-threaded WebAssembly — is only
 * available to a document the browser considers cross-origin isolated, which
 * needs two response headers together:
 *
 *     Cross-Origin-Opener-Policy:   same-origin
 *     Cross-Origin-Embedder-Policy: credentialless   (or require-corp)
 *
 * Both have teeth. COOP `same-origin` severs `window.opener`, so a popup that
 * posts a message back to the page that opened it stops working. COEP governs
 * every cross-origin subresource the document loads.
 *
 * WHY THIS IS SCOPED TO ROUTES RATHER THAN APPLIED SITE-WIDE.
 *
 * The auth SDK takes a full-page redirect when OCADE is not in an iframe, and
 * production forbids being iframed at all (`frame-ancestors 'none'`,
 * `X-Frame-Options: DENY`), so the live sign-in path is a redirect and COOP
 * cannot touch it. That was verified in the SDK source, not assumed.
 *
 * But the popup branch EXISTS in that SDK, and a future change — an embedded
 * preview, a native shell that sets a different user agent — could route
 * through it. Isolating the sign-in document to make an inference engine faster
 * would be trading a thing that must always work for a thing that is merely
 * nice, so the auth and landing documents are deliberately left alone.
 *
 * SAME ORIGIN, DIFFERENT DOCUMENTS. The isolated routes are on `ocade.in` like
 * everything else. That matters more than it looks: OPFS, IndexedDB and the
 * model vault are keyed by ORIGIN, so serving the engine from a second origin
 * would give it a second, empty storage bucket and the user would download the
 * model twice. Isolation is a per-DOCUMENT property, so scoping by path costs
 * nothing in storage and buys the whole of the safety above.
 *
 * THE CONSEQUENCE, AND IT IS NOT FREE: entering an isolated route has to be a
 * FULL DOCUMENT NAVIGATION. A client-side router transition keeps the current
 * document, which was not isolated, so `crossOriginIsolated` stays false and
 * threads never appear. `isolatedNavigationTarget` exists for exactly that.
 */

/**
 * The routes that run inference, and only those.
 *
 * Listed as explicit prefixes rather than "everything except auth", because the
 * failure modes are asymmetric: a route wrongly left OUT of this list runs
 * single-threaded, which is slower and correct, while a route wrongly put IN
 * could break a cross-origin resource nobody remembered it had. An allowlist is
 * the direction that fails safely.
 */
export const ISOLATED_PATH_PREFIXES = ["/ocade"] as const;

/**
 * Paths that must NEVER be isolated, checked first.
 *
 * `/auth` and everything under it, because that is where the popup branch would
 * run if it ever ran. Belt and braces: no prefix above matches these today, and
 * this makes it impossible for one added later to do so by accident.
 */
export const NEVER_ISOLATED_PATH_PREFIXES = ["/auth", "/.lovable"] as const;

/**
 * Should the document at this path be cross-origin isolated?
 *
 * Pure, so the decision is testable without a server, and shared so the
 * response headers and the client-side navigation guard cannot disagree about
 * which routes are isolated — a disagreement there produces either a page that
 * never gets threads or an infinite reload.
 */
export function shouldIsolate(pathname: string): boolean {
  const path = normalisePath(pathname);
  if (NEVER_ISOLATED_PATH_PREFIXES.some((prefix) => underPrefix(path, prefix))) return false;
  return ISOLATED_PATH_PREFIXES.some((prefix) => underPrefix(path, prefix));
}

/**
 * `credentialless`, not `require-corp`.
 *
 * `require-corp` demands that every cross-origin subresource opt in with a
 * `Cross-Origin-Resource-Policy` header. OCADE loads several that will never
 * send one and are not ours to change — the Cloudflare analytics beacon, images
 * a conversation may reference, media on public pages. Under `require-corp`
 * they would simply vanish, and the failure is silent.
 *
 * `credentialless` gets the same isolation by loading those requests WITHOUT
 * credentials instead of demanding a header. Nothing OCADE fetches
 * cross-origin needs cookies: the model artifacts are public and CORS-enabled,
 * Supabase authenticates with a bearer token in a header, and the beacon is
 * anonymous. So the weaker-looking option is the one that is both safe and
 * actually correct here.
 *
 * A browser that does not implement `credentialless` treats the value as
 * unrecognised, which means NOT ISOLATED — so it runs single-threaded rather
 * than breaking. That is the right way round.
 */
export const COEP_VALUE = "credentialless";
export const COOP_ISOLATED = "same-origin";

/**
 * COOP for documents that are not isolated.
 *
 * `same-origin-allow-popups` rather than nothing: it still stops a cross-origin
 * opener from reaching into this page, while leaving popups OCADE itself opens
 * able to talk back. That is precisely what the auth popup branch needs.
 */
export const COOP_DEFAULT = "same-origin-allow-popups";

export interface IsolationHeaders {
  "cross-origin-opener-policy": string;
  "cross-origin-embedder-policy"?: string;
}

/** The two headers this path should carry. */
export function isolationHeadersFor(pathname: string): IsolationHeaders {
  if (!shouldIsolate(pathname)) {
    return { "cross-origin-opener-policy": COOP_DEFAULT };
  }
  return {
    "cross-origin-opener-policy": COOP_ISOLATED,
    "cross-origin-embedder-policy": COEP_VALUE,
  };
}

/**
 * Does reaching this path require abandoning the current document?
 *
 * True when the destination is isolated and the current document is not, or the
 * other way round. Either direction needs a real navigation: an isolated
 * document cannot become un-isolated by changing its URL, and a normal one
 * cannot acquire `SharedArrayBuffer` by pushing history.
 *
 * The un-isolated direction matters as much as the isolated one. Client-side
 * routing from `/ocade` back to `/auth` would leave the sign-in UI running
 * inside an isolated document with `window.opener` severed — the popup hazard,
 * reached by the back button.
 */
export function needsFullNavigation(from: string, to: string): boolean {
  return shouldIsolate(from) !== shouldIsolate(to);
}

/**
 * Where a document should navigate to become correctly isolated, if anywhere.
 *
 * Returns null when nothing needs to happen, which is the overwhelmingly common
 * case and must stay cheap.
 *
 * `isolated` is what the platform reports, NOT what this module wants. A
 * browser that ignores `credentialless` will keep reporting false however many
 * times the page reloads, which is why the caller is required to attempt this
 * at most once — see `isolation-upgrade.ts`.
 */
export function isolationUpgradeTarget(input: {
  pathname: string;
  isolated: boolean;
  alreadyTried: boolean;
}): string | null {
  if (input.alreadyTried) return null;
  if (!shouldIsolate(input.pathname)) return null;
  if (input.isolated) return null;
  return input.pathname;
}

/**
 * Reduce a path to the route it actually addresses.
 *
 * DOT SEGMENTS ARE RESOLVED, and that is a security property rather than
 * tidiness. `/ocade/../auth` addresses `/auth`, but a prefix match on the raw
 * string sees `/ocade/` and would isolate it — putting the sign-in document,
 * the one page that must never be isolated, on the isolated side. Browsers
 * normalise before sending, so this is not reachable from a normal navigation;
 * a proxy, a crafted request or a server-side caller passing a constructed
 * string can all deliver the un-normalised form, and the cost of being wrong
 * here is a severed `window.opener` under a popup.
 *
 * Resolved the same way a URL parser does: `..` pops, `.` is dropped, empty
 * segments collapse.
 */
function normalisePath(pathname: string): string {
  if (typeof pathname !== "string" || pathname.length === 0) return "/";
  // Query and hash are not part of the routing decision, and a caller passing a
  // full URL should not silently get a different answer than one passing a path.
  const withoutQuery = pathname.split(/[?#]/)[0];

  const resolved: string[] = [];
  for (const segment of withoutQuery.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }
  return resolved.length > 0 ? `/${resolved.join("/")}` : "/";
}

/**
 * Is `path` at or below `prefix`?
 *
 * Segment-aware on purpose. A plain `startsWith` would match `/ocade-pricing`
 * against `/ocade` and isolate a marketing page, which is exactly the kind of
 * accidental inclusion the allowlist exists to prevent.
 */
function underPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}
