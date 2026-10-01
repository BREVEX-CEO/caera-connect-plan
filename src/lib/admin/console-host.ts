/**
 * THE CONSOLES HAVE AN ORIGIN OF THEIR OWN: `admin.` IN FRONT OF THE SITE'S.
 *
 * `admin.ocade.in` for `ocade.in`; `admin.localhost:8788` for a local proof. A
 * browser gives each origin its own storage, so the session the console signs
 * in with never sits beside the one that renders chat answers and web content —
 * and the database only lets that console session operate (migration
 * 20261001090000). The console origin serves the console and nothing else;
 * every other path belongs to the site.
 *
 * One rule, read by the Worker (which path goes where) and by the browser
 * (whether this page is the console or the site's way in to it).
 */
const PREFIX = "admin.";

export const isConsoleHost = (hostname: string): boolean => hostname.startsWith(PREFIX);

/** What the console origin answers itself: the console, its way in, its code prompt, server calls. */
const CONSOLE_PATH = /^\/(?:admin(?:\/.*)?|auth\/(?:console|challenge)|_serverFn\/.*)$/;

export const isConsolePath = (pathname: string): boolean => CONSOLE_PATH.test(pathname);

/** The same address on the site. */
export function onSite(url: URL): URL {
  const site = new URL(url);
  if (isConsoleHost(site.hostname)) site.hostname = site.hostname.slice(PREFIX.length);
  return site;
}

/** The console's origin for a site address. A bare IP has no subdomain, so a local proof uses `admin.localhost`. */
export function consoleOrigin(site: URL): string {
  const origin = new URL(site.origin);
  const numeric = /^[\d.]+$/.test(origin.hostname) || origin.hostname.startsWith("[");
  origin.hostname = PREFIX + (numeric ? "localhost" : origin.hostname);
  return origin.origin;
}

/**
 * The Worker's decision for a request on the console origin: null to serve it,
 * or where it belongs. Static files are served (the console needs its code and
 * fonts) except the service worker: the site's offline shell has no business
 * controlling the console.
 */
export function consoleHostRedirect(
  url: URL,
  isAsset: (pathname: string) => boolean,
): Response | null {
  if (!isConsoleHost(url.hostname)) return null;
  if (url.pathname === "/") {
    return new Response(null, { status: 302, headers: { location: "/admin" } });
  }
  if (isConsolePath(url.pathname)) return null;
  if (isAsset(url.pathname) && url.pathname !== "/sw.js") return null;
  return new Response(null, {
    status: 308,
    headers: { location: onSite(url).toString(), "cache-control": "public, max-age=3600" },
  });
}
