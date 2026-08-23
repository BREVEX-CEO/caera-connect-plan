/** A bounded parser for DuckDuckGo's non-AI HTML search result page. */

export interface SearchCandidate {
  title: string;
  url: string;
  domain: string;
}

const MAX_HTML_CHARS = 750_000;
const MAX_RESULTS = 10;

async function readBoundedHtml(response: Response): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > MAX_HTML_CHARS) {
      await reader.cancel();
      return null;
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function destination(raw: string): URL | null {
  try {
    const decoded = decodeHtml(raw);
    const href = decoded.startsWith("//") ? `https:${decoded}` : decoded;
    const parsed = new URL(href, "https://html.duckduckgo.com/");
    if (parsed.hostname.endsWith("duckduckgo.com") && parsed.pathname.startsWith("/l/")) {
      const target = parsed.searchParams.get("uddg");
      if (!target) return null;
      return new URL(target);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseSearchResults(html: string, limit = MAX_RESULTS): SearchCandidate[] {
  if (
    html.length > MAX_HTML_CHARS ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_RESULTS
  ) {
    return [];
  }
  const results: SearchCandidate[] = [];
  const seen = new Set<string>();
  const anchor =
    /<a\b[^>]*class=["'][^"']*\bresult__a\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchor)) {
    const url = destination(match[1]);
    if (!url || url.protocol !== "https:" || url.username || url.password || url.port) continue;
    url.hash = "";
    const key = `${url.hostname.toLowerCase()}${url.pathname}${url.search}`;
    if (seen.has(key)) continue;
    const title = decodeHtml(match[2]);
    if (!title) continue;
    seen.add(key);
    results.push({ title, url: url.toString(), domain: url.hostname.replace(/^www\./, "") });
    if (results.length >= limit) break;
  }
  return results;
}

export async function searchWeb(
  query: string,
  options: { fetch?: typeof globalThis.fetch; signal?: AbortSignal; limit?: number } = {},
): Promise<{ ok: true; results: SearchCandidate[] } | { ok: false; reason: string }> {
  const text = query.trim();
  if (text.length < 3 || text.length > 500) {
    return { ok: false, reason: "Current-information queries must contain 3 to 500 characters." };
  }
  const request = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!request) return { ok: false, reason: "This runtime has no Fetch API." };
  let response: Response;
  try {
    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", text);
    response = await request(url, {
      method: "GET",
      headers: { accept: "text/html", "user-agent": "OCADE/0.1 current-information retrieval" },
      redirect: "error",
      cache: "no-store",
      signal: options.signal,
    });
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error && error.name === "AbortError"
          ? "Web search timed out or was cancelled."
          : "Web search could not be reached.",
    };
  }
  if (!response.ok) return { ok: false, reason: `Web search returned HTTP ${response.status}.` };
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_HTML_CHARS) {
    return { ok: false, reason: "Web search returned too much data." };
  }
  const html = await readBoundedHtml(response);
  if (html === null) return { ok: false, reason: "Web search returned too much data." };
  const results = parseSearchResults(html, options.limit ?? 8);
  return results.length > 0
    ? { ok: true, results }
    : { ok: false, reason: "Web search returned no usable HTTPS sources." };
}
