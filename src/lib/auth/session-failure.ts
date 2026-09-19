/**
 * Why did the auth server not confirm this session?
 *
 * The authenticated layout is allowed to fall back to the locally persisted
 * session when the auth server cannot be REACHED. It must never do so when the
 * auth server was reached and said NO. Those two look identical at the call
 * site — `getUser()` returns `{ user: null, error }` for both — so the
 * distinction is made here, once, and tested.
 *
 * Fail-closed is the default: anything this function cannot confidently call a
 * transport failure is treated as a rejection, because the cost of guessing
 * wrong in that direction is a redirect to sign-in, while guessing wrong the
 * other way grants access to a revoked session.
 */

export type AuthFailureKind = "transport" | "rejected";

interface MaybeAuthError {
  name?: string;
  message?: string;
  status?: number;
  code?: string;
  cause?: unknown;
}

/** Substrings that only ever appear on a request that never got an answer. */
const TRANSPORT_MESSAGES = [
  "failed to fetch",
  "networkerror",
  "network error",
  "network request failed",
  "load failed",
  "fetch failed",
  "the internet connection appears to be offline",
  "err_internet_disconnected",
  "err_name_not_resolved",
  "err_connection",
  "getaddrinfo",
  "enotfound",
  "eai_again",
  "econnrefused",
  "econnreset",
  "etimedout",
  "timeout",
  "timed out",
  "aborted",
];

/**
 * There is no such thing as a transport STATUS.
 *
 * An HTTP status only exists because a server answered. 408, 429 and every 5xx
 * are answers too — a proxy in front of the auth server can return 502 while
 * happily returning 401 a second later, and a rate limiter returning 429 has
 * definitely seen the request. The previous version of this file treated all
 * of those as unreachability, which meant a hostile or misbehaving edge could
 * turn a revoked session into an authenticated one by answering 500.
 *
 * So: any explicit status fails closed. Retryable server conditions are still
 * distinguishable, but only when the LIBRARY says the request never completed
 * (see `isRetryableTransport`), never from the status number alone.
 */
function statusIsRejection(status: number): boolean {
  return status > 0;
}

/**
 * Signals from supabase-js / fetch that a request did not complete.
 *
 * `AuthRetryableFetchError` means "worth retrying", which is NOT the same as
 * "never answered". `@supabase/auth-js` raises it with `status: 0` when its own
 * fetch threw, and with the REAL STATUS for 500-530 — a server that answered.
 * Only the first of those is transport, so the name is trusted exactly when
 * there is no status to contradict it.
 */
function isRetryableTransport(err: MaybeAuthError): boolean {
  if (typeof err.status === "number" && statusIsRejection(err.status)) return false;
  return String(err.name ?? "")
    .toLowerCase()
    .includes("retryable");
}

function classifyAuthFailure(error: unknown): AuthFailureKind {
  if (!error) return "rejected";

  const err = error as MaybeAuthError;

  /*
   * An explicit status outranks everything else and always fails closed. A
   * rejection body can contain the word "timeout"; a 503 from a proxy proves
   * only that something on the path is alive and talking — and supabase-js
   * wraps exactly those in its retryable error, which is why the status is
   * read before the name rather than after it.
   */
  if (typeof err.status === "number" && statusIsRejection(err.status)) return "rejected";

  /* The library saying its own fetch never completed, with no status to deny it. */
  if (isRetryableTransport(err)) return "transport";

  // AuthApiError / AuthSessionMissingError are answers even without a status.
  const name = String(err.name ?? "").toLowerCase();
  if (name.includes("authapierror") || name.includes("sessionmissing")) return "rejected";
  if (name.includes("weakpassword") || name.includes("invalidcredentials")) return "rejected";

  /*
   * With no status and no library marker, the message is all that is left. A
   * raw `TypeError: Failed to fetch` is the browser's way of saying the
   * request never reached anyone, and an AbortError is our own timeout.
   */
  const message = String(err.message ?? "").toLowerCase();
  if (TRANSPORT_MESSAGES.some((needle) => message.includes(needle))) return "transport";

  if (err.cause && err.cause !== error) return classifyAuthFailure(err.cause);

  // Unknown shape. Fail closed.
  return "rejected";
}

/** True only when it is safe to stand in the locally persisted session. */
export function mayUseCachedSession(error: unknown): boolean {
  return classifyAuthFailure(error) === "transport";
}

/**
 * Is a cached session still usable on its own terms?
 *
 * Expiry is a timestamp, so it needs no network to evaluate and offline grace
 * never covers it. A session missing `expires_at` is refused rather than
 * assumed eternal.
 */
export function cachedSessionIsCurrent(
  session: { expires_at?: number | null } | null | undefined,
  now: number = Date.now(),
): boolean {
  const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
  return expiresAt > now;
}
