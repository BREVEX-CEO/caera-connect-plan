import { describe, it, expect } from "vitest";
import {
  classifyAuthFailure,
  mayUseCachedSession,
  cachedSessionIsCurrent,
} from "@/lib/auth/session-failure";

/**
 * The whole security property of the offline fallback is this classifier:
 * an unanswered request may degrade to the cached session, an ANSWER of "no"
 * may not.
 */

describe("unreachable auth server", () => {
  const transport = [
    { name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 },
    { name: "TypeError", message: "Failed to fetch" },
    { name: "TypeError", message: "NetworkError when attempting to fetch resource." },
    { name: "Error", message: "getaddrinfo ENOTFOUND sazhgaisyhkdbrooycdv.supabase.co" },
    { name: "Error", message: "connect ECONNREFUSED 127.0.0.1:443" },
    { name: "AbortError", message: "The operation was aborted" },
    { name: "Error", message: "Request timed out" },
    { name: "Error", message: "wrapped", cause: { name: "TypeError", message: "Failed to fetch" } },
  ];

  for (const error of transport) {
    it(`treats ${error.name} "${error.message}" as transport`, () => {
      expect(classifyAuthFailure(error)).toBe("transport");
      expect(mayUseCachedSession(error)).toBe(true);
    });
  }
});

describe("the auth server answered no", () => {
  const rejections = [
    { name: "AuthApiError", message: "invalid claim: missing sub claim", status: 401 },
    { name: "AuthApiError", message: "JWT expired", status: 401 },
    { name: "AuthApiError", message: "Invalid Refresh Token: Already Used", status: 400 },
    { name: "AuthApiError", message: "User is banned", status: 403 },
    { name: "AuthApiError", message: "User not found", status: 404 },
    { name: "AuthSessionMissingError", message: "Auth session missing!" },
    // A rejection body that happens to contain a transport-sounding word must
    // still fail closed, because the status is an answer.
    { name: "AuthApiError", message: "session timeout: token revoked", status: 401 },
    /*
     * SERVER-SIDE FAILURES ARE ANSWERS TOO.
     *
     * These used to be classified as transport on the theory that a 5xx means
     * "ask again later". It also means something on the path is alive and
     * replying — including a proxy, an edge worker or an attacker able to
     * force one status while the real answer is 401. Fallback exists for a
     * request that reached nobody, so a status number never grants it.
     */
    { name: "AuthApiError", message: "Service unavailable", status: 503 },
    { name: "AuthApiError", message: "Gateway timeout", status: 504 },
    { name: "AuthApiError", message: "Internal server error", status: 500 },
    { name: "AuthApiError", message: "Too many requests", status: 429 },
    { name: "AuthApiError", message: "Request timeout", status: 408 },
    // A transport-sounding message cannot rescue an answered request either.
    { name: "Error", message: "Failed to fetch", status: 502 },
  ];

  for (const error of rejections) {
    it(`refuses to fall back for ${error.name} (${error.status ?? "no status"})`, () => {
      expect(classifyAuthFailure(error)).toBe("rejected");
      expect(mayUseCachedSession(error)).toBe(false);
    });
  }

  it("keeps the library's own retryable marker as the ONLY server-side transport signal", () => {
    // supabase-js raises this when its fetch threw; it carries status 0.
    expect(classifyAuthFailure({ name: "AuthRetryableFetchError", status: 0 })).toBe("transport");
    // The same class WITH a real status is a completed request, so it fails
    // closed on the status rather than on the class name.
    expect(classifyAuthFailure({ name: "AuthApiError", status: 500 })).toBe("rejected");
  });

  it("fails closed on anything it cannot classify", () => {
    expect(classifyAuthFailure({})).toBe("rejected");
    expect(classifyAuthFailure("something odd")).toBe("rejected");
    expect(classifyAuthFailure(null)).toBe("rejected");
  });
});

describe("expiry is evaluated without a network", () => {
  const now = 1_700_000_000_000;
  it("accepts a session that has not expired", () => {
    expect(cachedSessionIsCurrent({ expires_at: now / 1000 + 600 }, now)).toBe(true);
  });
  it("refuses an expired cached session even when offline", () => {
    expect(cachedSessionIsCurrent({ expires_at: now / 1000 - 1 }, now)).toBe(false);
  });
  it("refuses a session with no expiry at all", () => {
    expect(cachedSessionIsCurrent({}, now)).toBe(false);
    expect(cachedSessionIsCurrent(null, now)).toBe(false);
  });
});
