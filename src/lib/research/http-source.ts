/**
 * Restricted HTTP acquisition seam for OCADE Research.
 *
 * The caller supplies an exact hostname allowlist. Initial and redirected URLs
 * are revalidated, credentials/referrers are omitted, response types and bytes
 * are bounded, and executable HTML content is discarded. Browser CORS, network
 * egress, DNS pinning, and provider access remain runtime responsibilities.
 */
import type { FetchResult, SourceFetcher } from "./research-run";

const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const ALLOWED_CONTENT_TYPES = new Set(["text/html", "text/plain", "application/json"]);

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type UrlValidation = { ok: true; url: URL } | { ok: false; reason: string };

export interface HttpSourceOptions {
  allowedHosts: string[];
  fetch?: FetchLike;
  maxBytes?: number;
  maxRedirects?: number;
  /**
   * Server-side DNS/address guard. It runs immediately before every request,
   * including redirects. The browser implementation may omit it because the
   * browser cannot reach private network targets through this server fetcher.
   */
  networkGuard?: (url: URL) => Promise<string | null>;
}

export function validateResearchUrl(raw: string, allowedHosts: string[]): UrlValidation {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "The source URL is malformed." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "Research acquisition requires HTTPS." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Credentialed source URLs are refused." };
  }
  if (url.port && url.port !== "443") {
    return { ok: false, reason: "Nonstandard source ports are refused." };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isPrivateOrLocalHost(hostname)) {
    return {
      ok: false,
      reason: "Local, private, link-local, and metadata targets are refused.",
    };
  }

  const allowed = new Set(
    allowedHosts.map((host) =>
      host
        .trim()
        .replace(/^\[|\]$/g, "")
        .toLowerCase(),
    ),
  );
  if (!allowed.has(hostname)) {
    return { ok: false, reason: "The source hostname is not in this run's allowlist." };
  }

  url.hash = "";
  return { ok: true, url };
}

export function createHttpSourceFetcher(options: HttpSourceOptions): SourceFetcher {
  const request = options.fetch ?? globalThis.fetch?.bind(globalThis);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  return async (_subquery, source, context): Promise<FetchResult> => {
    if (!request) return { result: "hard", error: "This runtime has no Fetch API." };
    if (!source.url) return { result: "hard", error: "This source has no acquisition URL." };
    if (!Number.isInteger(maxBytes) || maxBytes < 1) {
      return { result: "hard", error: "The response byte limit is invalid." };
    }
    if (!Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 10) {
      return { result: "hard", error: "The redirect limit is invalid." };
    }

    let checked = validateResearchUrl(source.url, options.allowedHosts);
    if (!checked.ok) return { result: "hard", error: checked.reason };

    for (let redirect = 0; redirect <= maxRedirects; redirect++) {
      if (options.networkGuard) {
        const refused = await options.networkGuard(checked.url);
        if (refused) return { result: "hard", error: refused };
      }
      let response: Response;
      try {
        response = await request(checked.url.toString(), {
          method: "GET",
          headers: { accept: "text/html, text/plain;q=0.9, application/json;q=0.8" },
          credentials: "omit",
          referrerPolicy: "no-referrer",
          redirect: "manual",
          cache: "no-store",
          signal: context.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return {
            result: "transient",
            error: "Source acquisition was cancelled or timed out.",
          };
        }
        return { result: "transient", error: "The source could not be reached." };
      }

      if (REDIRECTS.has(response.status)) {
        if (redirect === maxRedirects) {
          return { result: "hard", error: "The source exceeded the redirect limit." };
        }
        const location = response.headers.get("location");
        if (!location) {
          return {
            result: "hard",
            error: "The source returned a redirect without a destination.",
          };
        }
        const next = validateResearchUrl(
          new URL(location, checked.url).toString(),
          options.allowedHosts,
        );
        if (!next.ok) return { result: "hard", error: `Redirect refused: ${next.reason}` };
        checked = next;
        continue;
      }

      if (response.status === 429 || response.status >= 500) {
        return { result: "transient", error: `The source returned HTTP ${response.status}.` };
      }
      if (!response.ok) {
        return { result: "hard", error: `The source returned HTTP ${response.status}.` };
      }

      const contentType = (response.headers.get("content-type") ?? "")
        .split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        return {
          result: "hard",
          error: `Unsupported source content type: ${contentType || "missing"}.`,
        };
      }
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        return { result: "hard", error: "The source response is too large." };
      }

      const body = await readBounded(response, maxBytes);
      if (!body.ok) return { result: "hard", error: body.reason };
      const findings = contentType === "text/html" ? htmlToText(body.text) : body.text.trim();
      if (!findings) return { result: "hard", error: "The source returned no readable text." };

      return {
        result: "ok",
        findings,
        publishedAt: parseHttpDate(response.headers.get("last-modified")),
      };
    }

    return { result: "hard", error: "The source could not be acquired." };
  };
}

async function readBounded(
  response: Response,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  if (!response.body) return { ok: true, text: "" };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "The source response is too large." };
      }
      chunks.push(next.value);
    }
  } catch {
    return { ok: false, reason: "The source body could not be read." };
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(joined) };
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHttpDate(value: string | null): Date | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
}

function isPrivateOrLocalHost(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan")
  ) {
    return true;
  }
  if (hostname.includes(":")) return true;

  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((value) => value > 255)) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}
