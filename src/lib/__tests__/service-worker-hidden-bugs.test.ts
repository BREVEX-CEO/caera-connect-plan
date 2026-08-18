import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");

describe("service worker hidden regressions", () => {
  it("never caches auth, API, or server-function responses", () => {
    expect(sw).toContain('url.pathname === "/auth"');
    expect(sw).toContain('url.pathname.startsWith("/auth/")');
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toContain('url.pathname.startsWith("/_serverFn/")');
  });

  it("extends fetch-event lifetime for cache writes", () => {
    const occurrences = sw.match(/event\.waitUntil\(cacheSuccessful\(/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("has an explicit first-install retry path for flaky connections", () => {
    expect(sw).toContain("OCADE_RETRY_OFFLINE_CACHE");
    expect(sw).toContain("fetchWithRetry");
    expect(sw).toContain("OCADE_SHELL_CACHE_STATUS");
  });
});
