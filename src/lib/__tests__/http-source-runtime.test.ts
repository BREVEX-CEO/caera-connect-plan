import { describe, it, expect } from "vitest";
import { createHttpSourceFetcher, validateResearchUrl } from "../research/http-source";

/**
 * Research source acquisition — SSRF defences and redirect re-validation.
 *
 * A NOTE ON WHY THIS IS NOT A LOOPBACK TEST.
 *
 * I first wrote this against a local HTTP server, reasoning that loopback gives
 * real sockets without public egress. Every case failed — because
 * `validateResearchUrl` deliberately refuses `http:`, non-443 ports, and every
 * local, private, link-local and metadata address.
 *
 * That is the anti-SSRF control doing exactly its job. Research acquisition
 * must never be pointable at internal infrastructure: the classic attack is a
 * "source URL" of http://169.254.169.254/ or http://127.0.0.1:6379/. Rewriting
 * the fetcher to permit loopback so a test could reach it would have destroyed
 * the control to manufacture a green tick.
 *
 * So the fetcher CANNOT be exercised over real sockets in an environment with
 * no public egress, and that is a property worth having rather than a gap.
 * What is tested instead is everything that decides whether a request is made
 * at all — which is where the security lives — plus the redirect and status
 * logic via the module's own injectable fetch.
 */

const ALLOWED = "news.example.org";
const context = { signal: undefined as AbortSignal | undefined };
const source = (url: string) => ({ id: "s1", url }) as never;

describe("SSRF defences — refused BEFORE any request is made", () => {
  const attacks: Array<[string, string]> = [
    ["cloud metadata service", "https://169.254.169.254/latest/meta-data/"],
    ["loopback by name", "https://localhost/admin"],
    ["loopback by address", "https://127.0.0.1/admin"],
    ["IPv6 loopback", "https://[::1]/admin"],
    ["private 10.x", "https://10.0.0.5/internal"],
    ["private 192.168.x", "https://192.168.1.1/router"],
    ["private 172.16.x", "https://172.16.0.10/internal"],
    ["link-local", "https://169.254.1.1/"],
  ];

  for (const [label, url] of attacks) {
    it(`refuses ${label}`, () => {
      // Allowlisted or not, an internal target is refused outright.
      const asHost = new URL(url).hostname.replace(/^\[|\]$/g, "");
      const verdict = validateResearchUrl(url, [asHost, ALLOWED]);
      expect(verdict.ok, `${label} was allowed`).toBe(false);
      if (verdict.ok) throw new Error("unreachable");
      expect(verdict.reason).toMatch(/local, private, link-local, and metadata/i);
    });
  }

  it("refuses plain HTTP, so a source cannot be read over a downgraded channel", () => {
    const verdict = validateResearchUrl(`http://${ALLOWED}/article`, [ALLOWED]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.reason).toMatch(/requires HTTPS/i);
  });

  it("refuses credentials embedded in the URL", () => {
    const verdict = validateResearchUrl(`https://user:pass@${ALLOWED}/x`, [ALLOWED]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.reason).toMatch(/credentialed/i);
  });

  it("refuses a nonstandard port, closing internal-service scanning", () => {
    const verdict = validateResearchUrl(`https://${ALLOWED}:6379/`, [ALLOWED]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.reason).toMatch(/nonstandard source ports/i);
  });

  it("refuses non-http schemes outright", () => {
    for (const url of ["file:///etc/passwd", "javascript:alert(1)", "data:text/html,<h1>x"]) {
      expect(validateResearchUrl(url, [ALLOWED]).ok, url).toBe(false);
    }
  });

  it("refuses a host that is not on the run's allowlist", () => {
    const verdict = validateResearchUrl("https://other.example.com/x", [ALLOWED]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.reason).toMatch(/not in this run's allowlist/i);
  });

  it("accepts a genuinely allowed https source and strips the fragment", () => {
    const verdict = validateResearchUrl(`https://${ALLOWED}/article#section-2`, [ALLOWED]);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) throw new Error("unreachable");
    expect(verdict.url.hash).toBe("");
  });
});

/**
 * The redirect and status logic, driven through the module's own `fetch`
 * option. Responses are real `Response` objects; only the transport is stubbed,
 * because the transport is the part that cannot legally reach anywhere here.
 */
function fetcherWith(handler: (url: string) => Response, extra = {}) {
  return createHttpSourceFetcher({
    allowedHosts: [ALLOWED],
    fetch: async (url: string) => handler(String(url)),
    ...extra,
  });
}

describe("redirects are re-validated, not merely followed", () => {
  it("follows a redirect that stays inside the allowlist", async () => {
    const fetcher = fetcherWith((url) =>
      url.endsWith("/start")
        ? new Response(null, { status: 302, headers: { location: `https://${ALLOWED}/article` } })
        : new Response("<h1>Council approves bridge</h1>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
    );
    const result = await fetcher("q", source(`https://${ALLOWED}/start`), context as never);
    expect(result.result).toBe("ok");
    expect(JSON.stringify(result)).toContain("Council approves bridge");
  });

  it("REFUSES a redirect that leaves the allowlist", async () => {
    // Allowlisting only the first URL would let an allowed host bounce the
    // fetcher anywhere it liked.
    const fetcher = fetcherWith(
      () =>
        new Response(null, { status: 302, headers: { location: "https://evil.example/secret" } }),
    );
    const result = await fetcher("q", source(`https://${ALLOWED}/start`), context as never);
    expect(result.result).toBe("hard");
    expect(JSON.stringify(result)).toMatch(/redirect refused/i);
  });

  it("REFUSES a redirect to an internal address", async () => {
    // The SSRF attack delivered via redirect rather than the initial URL.
    const fetcher = fetcherWith(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://169.254.169.254/latest/meta-data/" },
        }),
    );
    const result = await fetcher("q", source(`https://${ALLOWED}/start`), context as never);
    expect(result.result).toBe("hard");
    expect(JSON.stringify(result)).toMatch(/redirect refused/i);
  });

  it("stops a redirect loop at the limit rather than spinning", async () => {
    const fetcher = fetcherWith(
      () => new Response(null, { status: 302, headers: { location: `https://${ALLOWED}/loop` } }),
      { maxRedirects: 3 },
    );
    const result = await fetcher("q", source(`https://${ALLOWED}/loop`), context as never);
    expect(result.result).toBe("hard");
    expect(JSON.stringify(result)).toMatch(/redirect limit/i);
  });

  it("refuses a redirect with no destination", async () => {
    const fetcher = fetcherWith(() => new Response(null, { status: 302 }));
    const result = await fetcher("q", source(`https://${ALLOWED}/x`), context as never);
    expect(result.result).toBe("hard");
    expect(JSON.stringify(result)).toMatch(/without a destination/i);
  });
});

describe("failures are classified so retry behaviour is correct", () => {
  it("treats 5xx as TRANSIENT, so it may be retried", async () => {
    const fetcher = fetcherWith(() => new Response("down", { status: 503 }));
    const result = await fetcher("q", source(`https://${ALLOWED}/x`), context as never);
    expect(result.result).toBe("transient");
    expect(JSON.stringify(result)).toContain("503");
  });

  it("treats 429 as TRANSIENT", async () => {
    const fetcher = fetcherWith(() => new Response("slow down", { status: 429 }));
    const result = await fetcher("q", source(`https://${ALLOWED}/x`), context as never);
    expect(result.result).toBe("transient");
  });

  it("never returns an empty document in place of a failure", async () => {
    // The dangerous outcome: a claim reported as "supported" by a source that
    // was never actually read.
    const fetcher = fetcherWith(() => {
      throw new Error("connection reset");
    });
    const result = await fetcher("q", source(`https://${ALLOWED}/x`), context as never);
    expect(result.result).toBe("transient");
    expect(JSON.stringify(result)).not.toMatch(/"text"\s*:\s*""/);
  });

  it("reports a cancelled fetch as transient, never as a result", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = fetcherWith(() => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });
    const result = await fetcher("q", source(`https://${ALLOWED}/x`), {
      signal: controller.signal,
    } as never);
    expect(result.result).toBe("transient");
    expect(JSON.stringify(result)).toMatch(/cancelled|timed out/i);
  });
});
