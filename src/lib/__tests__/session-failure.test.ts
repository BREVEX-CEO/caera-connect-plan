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
    { name: "Error", message: "getaddrinfo ENOTFOUND ubantxggjducfmwoydim.supabase.co" },
    { name: "Error", message: "connect ECONNREFUSED 127.0.0.1:443" },
    { name: "AbortError", message: "The operation was aborted" },
    { name: "Error", message: "Request timed out" },
    { name: "AuthApiError", message: "Service unavailable", status: 503 },
    { name: "AuthApiError", message: "Gateway timeout", status: 504 },
    { name: "AuthApiError", message: "Too many requests", status: 429 },
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
  ];

  for (const error of rejections) {
    it(`refuses to fall back for ${error.name} (${error.status ?? "no status"})`, () => {
      expect(classifyAuthFailure(error)).toBe("rejected");
      expect(mayUseCachedSession(error)).toBe(false);
    });
  }

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
