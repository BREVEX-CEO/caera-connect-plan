/**
 * The one question this file answers is whether a revoked session can survive
 * an upstream failure, so the cases that matter are the ones where the auth
 * server ANSWERED with something unhelpful.
 *
 * The errors are built with the real `@supabase/auth-js` classes rather than
 * object literals. A hand-written `{ name: "AuthRetryableFetchError" }` proves
 * only that the test author and the code agree; the library is what production
 * actually throws, and it is what changed underneath this code.
 */
import { describe, expect, it } from "vitest";
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/auth-js";
import { cachedSessionIsCurrent, mayUseCachedSession } from "../session-failure";

describe("mayUseCachedSession", () => {
  it("refuses the cached session when supabase reports a 5xx it would retry", () => {
    // auth-js/lib/fetch.ts: every status in 500,501,502,503,504,520-530 is
    // wrapped in AuthRetryableFetchError WITH THE REAL STATUS. A server that
    // answered 503 is not a server that could not be reached.
    for (const status of [
      500, 501, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530,
    ]) {
      expect(mayUseCachedSession(new AuthRetryableFetchError("Service unavailable", status))).toBe(
        false,
      );
    }
  });

  it("allows the cached session only when the request never completed", () => {
    // The same class, raised with status 0, is the library saying its own
    // fetch threw — no response, no answer, nothing to fail closed against.
    expect(mayUseCachedSession(new AuthRetryableFetchError("Failed to fetch", 0))).toBe(true);
    expect(mayUseCachedSession(new TypeError("Failed to fetch"))).toBe(true);
    expect(mayUseCachedSession(new DOMException("Aborted", "AbortError"))).toBe(true);
  });

  it("refuses every answer, however it is shaped", () => {
    expect(mayUseCachedSession(new AuthApiError("Invalid token", 401, "bad_jwt"))).toBe(false);
    expect(mayUseCachedSession(new AuthSessionMissingError())).toBe(false);
    expect(mayUseCachedSession({ status: 429, message: "request timeout" })).toBe(false);
    expect(mayUseCachedSession({ message: "something unrecognised" })).toBe(false);
    expect(mayUseCachedSession(null)).toBe(false);
    expect(mayUseCachedSession(undefined)).toBe(false);
  });

  it("reads a wrapped cause, and still fails closed on its status", () => {
    const answered = Object.assign(new Error("wrapper"), {
      cause: new AuthRetryableFetchError("Bad gateway", 502),
    });
    expect(mayUseCachedSession(answered)).toBe(false);

    const unreachable = Object.assign(new Error("wrapper"), {
      cause: new TypeError("Failed to fetch"),
    });
    expect(mayUseCachedSession(unreachable)).toBe(true);
  });
});

describe("cachedSessionIsCurrent", () => {
  const now = 1_700_000_000_000;

  it("accepts only a session whose own expiry is still ahead", () => {
    expect(cachedSessionIsCurrent({ expires_at: now / 1000 + 60 }, now)).toBe(true);
    expect(cachedSessionIsCurrent({ expires_at: now / 1000 - 1 }, now)).toBe(false);
    expect(cachedSessionIsCurrent({ expires_at: null }, now)).toBe(false);
    expect(cachedSessionIsCurrent(null, now)).toBe(false);
  });
});
