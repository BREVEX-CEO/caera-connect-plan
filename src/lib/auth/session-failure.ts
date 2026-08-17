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
 * HTTP statuses that mean "ask again later", not "you are not who you say".
 * 408 request timeout, 429 rate limit and every 5xx are the auth server (or a
 * proxy in front of it) failing to answer, which is an unreachability of the
 * same kind as a dropped socket.
 */
function statusIsTransport(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

export function classifyAuthFailure(error: unknown): AuthFailureKind {
  if (!error) return "rejected";

  const err = error as MaybeAuthError;

  /*
   * An explicit status is the strongest signal available and outranks the
   * message, because a rejection body can contain words like "timeout" while
   * still being a 401. 401/403/400 are answers.
   */
  if (typeof err.status === "number" && err.status > 0) {
    return statusIsTransport(err.status) ? "transport" : "rejected";
  }

  const name = String(err.name ?? "").toLowerCase();
  // supabase-js labels its own retryable transport failures.
  if (name.includes("retryable")) return "transport";
  // AuthApiError / AuthSessionMissingError / AuthWeakPasswordError are answers.
  if (name.includes("authapierror") || name.includes("sessionmissing")) return "rejected";

  const message = String(err.message ?? "").toLowerCase();
  if (TRANSPORT_MESSAGES.some((needle) => message.includes(needle))) return "transport";

  // A raw TypeError from fetch has no status and a browser-specific message;
  // the list above covers the known ones, and the cause is checked once more
  // in case the failure was wrapped.
  if (err.cause && err.cause !== error) return classifyAuthFailure(err.cause);

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
