/**
 * What a seal still lets through, and why each exception is safe.
 *
 * WHY THIS FILE EXISTS. Sealed mode used to be installed only around the
 * `generate()` call, for the milliseconds an answer was being produced — while
 * the button said "Sealed" and the toast said "Nothing can leave this device
 * until you unseal it". Measured in the running app, `fetch`,
 * `XMLHttpRequest`, `WebSocket` and `navigator.sendBeacon` were all still the
 * native ones the whole time the UI claimed otherwise. The mechanism was
 * complete and correct; nothing had connected it to the surface making the
 * promise.
 *
 * Making the promise true means keeping the seal up for as long as the user
 * says. A seal that blocks literally everything cannot stay up — the moment you
 * navigate, the app asks for its next route chunk, is refused, and the page
 * breaks. So the real question is not "block everything" versus "block during a
 * send": it is to define exactly what CANNOT carry a conversation off the
 * machine, allow precisely that, and refuse the rest indefinitely.
 *
 * TWO EXCEPTIONS, both narrow:
 *
 * 1. SAME-ORIGIN STATIC ASSETS — the script, stylesheet and font files the app
 *    serves itself. They are fetched by URL with no request body, and the URL
 *    is a build path, so there is nowhere for conversation text to ride along.
 *    Anything with a body, a non-GET method, or a content path is not an asset:
 *    `/api/`, `/_serverFn/` and `/auth/` are refused precisely because they are
 *    the same-origin paths that DO carry content.
 *
 * 2. LOOPBACK — the on-device engine listens on `localhost`. A request there
 *    never reaches a network interface, which is the whole claim being made.
 *    The pattern is deliberately the one `provenance/network-witness.ts` uses
 *    to classify a contact as `this_device`, so the seal and the receipt cannot
 *    end up disagreeing about what "left the device" means.
 *
 * Everything else — every cross-origin host, every POST, every beacon — is
 * refused and recorded.
 *
 * FAILS CLOSED. Anything this cannot parse or cannot categorise is refused. An
 * allowlist that guesses in the permissive direction is not an allowlist.
 */

/** Same definition the provenance witness uses for `this_device`. */
const LOOPBACK = /^(localhost|127(?:\.\d+){3}|\[::1\]|::1|.*\.localhost)$/i;

/** Paths that carry content rather than code, even on our own origin. */
const CONTENT_PATHS = [/^\/api\//, /^\/_serverFn\//, /^\/auth\//];

const ASSET_EXTENSION = /\.(js|mjs|cjs|css|woff2?|ttf|otf|png|jpe?g|svg|gif|webp|ico|wasm|map)$/i;

/** Directories the build and the dev server serve modules from. */
const ASSET_DIRECTORIES = /^\/(src|assets|_build|node_modules|@vite|@fs|@id)\//;

export interface SealRequest {
  url: string;
  /** Defaults to GET, matching `fetch` itself. */
  method?: string;
  /** True when the request carries a body, which an asset load never does. */
  hasBody?: boolean;
}

/** A predicate deciding whether one request may proceed while sealed. */
export type SealAllow = (request: SealRequest) => boolean;

export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK.test(hostname);
}

/**
 * The page-level policy: static assets and loopback only.
 *
 * `origin` is injected rather than read from `location`, so every branch is
 * reachable from a test on one machine — including the cross-origin one, which
 * is the branch that actually matters.
 */
export function allowAssetsAndLoopback(origin: string): SealAllow {
  return (request) => {
    let url: URL;
    try {
      url = new URL(request.url, origin);
    } catch {
      return false;
    }

    if (isLoopbackHost(url.hostname)) return true;
    if (url.origin !== origin) return false;

    const method = (request.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") return false;
    if (request.hasBody) return false;
    if (CONTENT_PATHS.some((p) => p.test(url.pathname))) return false;

    /*
     * A query string alone must not disqualify an asset — the dev server serves
     * modules as `/src/x.tsx?t=1739`. It is the PATH that decides, and a path
     * outside the build directories with no asset extension is refused whether
     * or not it has a query.
     */
    return ASSET_EXTENSION.test(url.pathname) || ASSET_DIRECTORIES.test(url.pathname);
  };
}

/**
 * The default: nothing at all may leave.
 *
 * Used by the send-time seal, which wraps a single `generate()` call and has no
 * reason to let even an asset through.
 */
export const allowNothing: SealAllow = () => false;

/**
 * Combine overlapping policies. A request proceeds only if EVERY seal in force
 * allows it.
 *
 * This is what stops a permissive page seal from loosening a strict send seal.
 * The reference counting in `sealed-mode.ts` means the second seal to arrive
 * does not re-patch — it joins — so without intersection the send would silently
 * inherit whatever the page-level seal happened to permit. Most restrictive
 * wins, always.
 */
export function intersect(policies: Iterable<SealAllow>): SealAllow {
  return (request) => {
    for (const allow of policies) if (!allow(request)) return false;
    return true;
  };
}

/** Minimal shape of a seal, so this module does not import `sealed-mode`. */
interface Sealable {
  seal(): void;
  unseal(): unknown;
}

/**
 * Install a conversation-long seal, and hand back how to lift it.
 *
 * WHY THIS IS A FUNCTION AND NOT FOUR LINES INSIDE A `useEffect`. The defect
 * that led here was never in `Seal` — that class was correct, complete and
 * covered by a mutation the suite catches. The defect was that no screen ever
 * called it outside a send, so the button said "Sealed" over an unsealed page.
 * A guarantee living only inside a component effect is a guarantee no test can
 * reach: this project has no DOM renderer, so an effect is unreachable from
 * vitest by construction.
 *
 * Pulling the body out here makes the wiring itself testable with a fake scope,
 * which is the part that was actually broken. Both chat surfaces call this, so
 * they cannot drift apart either.
 *
 * @returns the cleanup to run when the seal should lift, or undefined when
 *   nothing was installed — matching what a `useEffect` body must return.
 */
export function installConversationSeal(
  sealed: boolean,
  make: (allow: SealAllow) => Sealable,
  origin: string | undefined,
): (() => void) | undefined {
  if (!sealed || !origin) return undefined;
  const seal = make(allowAssetsAndLoopback(origin));
  seal.seal();
  return () => {
    seal.unseal();
  };
}
