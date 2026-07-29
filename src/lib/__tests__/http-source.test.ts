import { describe, expect, it, vi } from "vitest";
import { createHttpSourceFetcher, validateResearchUrl } from "../research/http-source";
import type { SourceRecord } from "../research/source-ranking";

const source = (url?: string): SourceRecord => ({
  id: "official",
  title: "Official status",
  publisher: "Agency",
  kind: "official",
  publishedAt: null,
  retrievedAt: new Date("2026-07-25T00:00:00Z"),
  url,
});

describe("research URL boundary", () => {
  it("accepts only allowlisted HTTPS origins", () => {
    expect(validateResearchUrl("https://status.example/report", ["status.example"]).ok).toBe(true);
    expect(validateResearchUrl("http://status.example/report", ["status.example"]).ok).toBe(false);
    expect(validateResearchUrl("https://elsewhere.example/report", ["status.example"]).ok).toBe(
      false,
    );
  });

  it.each([
    "https://localhost/report",
    "https://127.0.0.1/report",
    "https://10.0.0.4/report",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/report",
    "https://user:pass@status.example/report",
    "https://status.example:8443/report",
  ])("rejects local, credentialed, or nonstandard targets: %s", (url) => {
    expect(
      validateResearchUrl(url, [
        "status.example",
        "localhost",
        "127.0.0.1",
        "10.0.0.4",
        "169.254.169.254",
        "[::1]",
      ]).ok,
    ).toBe(false);
  });
});

describe("bounded HTTP source fetcher", () => {
  it("returns readable content without forwarding credentials or referrers", async () => {
    const request = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.credentials).toBe("omit");
      expect(init?.referrerPolicy).toBe("no-referrer");
      expect(init?.redirect).toBe("manual");
      return new Response(
        "<html><body><h1>Bridge open</h1><script>secret()</script></body></html>",
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      );
    });
    const fetcher = createHttpSourceFetcher({ allowedHosts: ["status.example"], fetch: request });
    const result = await fetcher("bridge", source("https://status.example/report"), {
      attempt: 1,
      signal: new AbortController().signal,
    });
    expect(result.result).toBe("ok");
    expect(result.findings).toContain("Bridge open");
    expect(result.findings).not.toContain("secret()");
    expect(request).toHaveBeenCalledOnce();
  });

  it("revalidates redirect targets", async () => {
    const request = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://169.254.169.254/latest/meta-data" },
        }),
    );
    const fetcher = createHttpSourceFetcher({ allowedHosts: ["status.example"], fetch: request });
    const result = await fetcher("bridge", source("https://status.example/report"), { attempt: 1 });
    expect(result.result).toBe("hard");
    expect(result.error).toMatch(/redirect|allowed|private/i);
    expect(request).toHaveBeenCalledOnce();
  });

  it("rejects unsupported content and oversized bodies", async () => {
    const binary = createHttpSourceFetcher({
      allowedHosts: ["status.example"],
      fetch: async () =>
        new Response("data", { headers: { "content-type": "application/octet-stream" } }),
    });
    expect((await binary("q", source("https://status.example/file"), { attempt: 1 })).result).toBe(
      "hard",
    );

    const oversized = createHttpSourceFetcher({
      allowedHosts: ["status.example"],
      maxBytes: 4,
      fetch: async () => new Response("12345", { headers: { "content-type": "text/plain" } }),
    });
    const result = await oversized("q", source("https://status.example/file"), { attempt: 1 });
    expect(result.result).toBe("hard");
    expect(result.error).toMatch(/large/i);
  });
});
