/**
 * WHERE `/` SENDS SOMEBODY.
 *
 * `docs/APP_FLOW.md` states three rules and they are not interchangeable:
 *
 *   - a first, unseen visit gets the commercial landing page;
 *   - a returning visit with a session goes straight to `/ocade`, which is Chat;
 *   - a returning visit without one goes to `/auth`.
 *
 * The third rule is the reason this exists at all. Sending somebody who signed
 * out yesterday back through the marketing page every morning is not a
 * welcome, it is an obstacle between a person and their own work.
 *
 * TWO FACTS, READ FROM TWO PLACES, ON PURPOSE.
 *
 * "Has this device seen the landing page" is a COOKIE because the server has
 * to answer it before it renders anything: a returning visitor must never be
 * sent the landing markup and then have it swapped out under them. A crawler
 * carries no cookie, so it always gets the landing page — which is the whole
 * point of rendering `/` on the server.
 *
 * "Is there a session on this device" is LOCAL STORAGE because that is where
 * `@supabase/supabase-js` keeps it, and it is therefore only knowable in the
 * browser. It is read as a PROBE, never as proof: the value is not decoded,
 * not trusted and not used to authorise anything. A stale or expired token
 * sends the visitor to `/ocade`, where the real gate in
 * `src/routes/_authenticated/route.tsx` asks the auth server and bounces them
 * to `/auth`. The probe can only ever cost a redirect, never access.
 *
 * The cookie holds `1`. It is a device flag and never conversation, account or
 * identity content — `docs/APP_FLOW.md` allows exactly this and nothing more.
 */

/** The device flag that records that the landing page has been shown once. */
export const LANDING_SEEN_COOKIE = "ocade_landing_seen";

/** A year. Long enough that a returning visitor is not re-marketed to; not permanent. */
const LANDING_SEEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Where a visit to `/` resolves. */
export type RootEntry = "landing" | "workspace" | "sign-in";

/**
 * Read one cookie out of a `Cookie` header or `document.cookie`.
 *
 * Written here rather than reached for from a library because both callers
 * hand over the same shape and the alternative — a regular expression built
 * from an interpolated name at each call site — is how a cookie called
 * `ocade_landing_seen_at` starts answering for `ocade_landing_seen`.
 */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

/** Whether this device has already been shown the landing page. */
export function hasSeenLanding(cookieHeader: string | null | undefined): boolean {
  return readCookie(cookieHeader, LANDING_SEEN_COOKIE) === "1";
}

/**
 * The destination for a visit to `/`.
 *
 * Pure, and separate from both readers, so the rule itself is testable without
 * a browser, a request or a Supabase project.
 */
export function rootEntryFor(input: { seenLanding: boolean; storedSession: boolean }): RootEntry {
  /*
   * The session wins over the flag. Somebody who signs in on a device that has
   * never seen the landing page — a deep link, a shared machine, a restored
   * profile — is still a person with work waiting, and showing them marketing
   * because of a missing cookie would be the same obstacle in a new place.
   */
  if (input.storedSession) return "workspace";
  return input.seenLanding ? "sign-in" : "landing";
}

/**
 * The key `@supabase/supabase-js` stores the session under, derived the way the
 * library derives it: `sb-<first hostname label>-auth-token`.
 *
 * Returns null when this deployment has no project bound, because then there is
 * no session to look for and no key that could hold one.
 */
export function sessionStorageKeyFor(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  try {
    return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

/**
 * Whether this browser is holding something that looks like a session.
 *
 * The exact key first, and a prefix scan only as a fallback: a device that has
 * been pointed at two projects holds two keys, and answering "yes" from the
 * wrong one would send a signed-out visitor to a workspace that immediately
 * signs them out again.
 */
export function hasStoredSupabaseSession(supabaseUrl: string | undefined): boolean {
  if (typeof window === "undefined") return false;
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    /* Blocked storage — no session can be read, and none can be claimed. */
    return false;
  }

  const key = sessionStorageKeyFor(supabaseUrl);
  if (key) return Boolean(storage.getItem(key));

  for (let index = 0; index < storage.length; index += 1) {
    const candidate = storage.key(index);
    if (candidate && /^sb-.+-auth-token$/.test(candidate) && storage.getItem(candidate)) {
      return true;
    }
  }
  return false;
}

/**
 * Record that the landing page has been shown.
 *
 * `SameSite=Lax` because the flag must survive arriving from a link somebody
 * was sent, which is most of how a landing page is reached. Not `Secure`,
 * deliberately: the development server is plain HTTP, and a flag that only sets
 * itself in production is a flag nobody tests.
 */
export function markLandingSeen(): void {
  if (typeof document === "undefined") return;
  if (hasSeenLanding(document.cookie)) return;
  document.cookie = `${LANDING_SEEN_COOKIE}=1; Max-Age=${LANDING_SEEN_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}
