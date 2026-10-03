/**
 * WHERE OCADE IS ALLOWED TO SEND SOMEBODY AFTER THEY SIGN IN.
 *
 * THE GAP THIS CLOSES. Two copies of this function existed, in `auth.tsx` and
 * `auth.callback.tsx`, and both began the same way:
 *
 *     if (value.startsWith("/") && !value.startsWith("//")) return value;
 *
 * That reads as "a relative path, not a protocol-relative URL", and it is not.
 * A browser normalises a backslash to a forward slash when resolving a URL for
 * an http(s) origin, so `/\evil.com` starts with a single slash, does not start
 * with `//`, is returned unchanged — and resolves to `https://evil.com/`.
 * Measured, not theorised:
 *
 *     new URL("/\\evil.com", "https://ocade.test")  ->  https://evil.com/
 *
 * A sign-in link carrying `?next=/\evil.com` is a phishing page reached
 * through OCADE's own domain, after a real sign-in, which is the version of an
 * open redirect that actually fools people.
 *
 * THE FIX IS TO STOP PATTERN-MATCHING THE STRING. Resolve it the way a browser
 * will, then require the RESULT to be this origin. What a URL means is decided
 * by the URL parser, so the parser is what decides.
 *
 * ONE COPY, because the two disagreed: the callback's version rejected
 * same-origin absolute URLs that the sign-in page accepted, so the same link
 * behaved differently depending on which screen read it.
 */

/**
 * The default when there is no usable destination.
 *
 * Chat, which is `/`. It used to be `/ocade`, a workspace route that no longer
 * exists; before that it was `/home`, a forwarding address that sent every
 * sign-in, verification and password reset through an extra navigation to
 * arrive at the same screen.
 */
export const DEFAULT_NEXT = "/";

/**
 * Resolve a `next` parameter to a path OCADE may navigate to, or null.
 *
 * @param value  Whatever arrived in the URL. Untrusted.
 * @param origin The origin to resolve against. Defaults to this window's.
 */
export function safeNext(value: string | undefined | null, origin?: string): string | null {
  if (!value) return null;

  const base = origin ?? (typeof window === "undefined" ? undefined : window.location.origin);
  if (!base) {
    /*
     * SERVER-SIDE, WITH NO ORIGIN TO COMPARE AGAINST. Only a plain path is
     * accepted, and the backslash case is refused explicitly rather than
     * relying on a prefix test that a browser would disagree with.
     */
    return /^\/[^/\\]/.test(value) || value === "/" ? value : null;
  }

  let resolved: URL;
  try {
    resolved = new URL(value, base);
  } catch {
    return null;
  }

  if (resolved.origin !== new URL(base).origin) return null;

  /*
   * Returned as a path rather than as the caller's original string, so a value
   * that resolved to this origin by a route the caller did not expect arrives
   * in the normalised form the router will actually use.
   *
   * AND THE NORMALISED PATH IS CHECKED AGAIN, because normalisation can
   * produce a new protocol-relative URL out of a path that was not one:
   *
   *     new URL("/..//evil.com", "https://ocade.test").pathname  ->  //evil.com
   *
   * The resolved ORIGIN there is still ocade.test, so the origin check passes
   * — and the string handed back begins with two slashes, which is exactly
   * the form this function exists to refuse. Whatever consumes it next would
   * resolve it a second time and land on evil.com.
   */
  const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
  return path.startsWith("//") ? null : path;
}

const NEXT_KEY = "ocade:auth:next";

/** Where to go after the provider sends the person back; kept in this tab only. */
export function rememberNext(path: string): void {
  try {
    if (path === DEFAULT_NEXT) window.sessionStorage.removeItem(NEXT_KEY);
    else window.sessionStorage.setItem(NEXT_KEY, path);
  } catch {
    /* No storage: the person lands on Chat, still signed in. */
  }
}

/**
 * The remembered destination, still checked by `safeNext` like any other. Read, not taken:
 * an effect may run twice, and every Google sign-in writes (or clears) it afresh.
 */
export function rememberedNext(): string | null {
  try {
    return window.sessionStorage.getItem(NEXT_KEY);
  } catch {
    return null;
  }
}
