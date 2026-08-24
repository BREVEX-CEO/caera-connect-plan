/**
 * FINDING PAGES WORTH READING, WITHOUT ASKING AN AI TO PICK THEM.
 *
 * WHY DISCOVERY IS NEEDED AT ALL. `runResearchQuery` takes its candidate
 * sources from the caller, and the only caller — the research panel on
 * `/ocade/lab` — passes two hardcoded URLs about flood warnings. That is fine
 * for a demonstration and useless for Chat, where the question is whatever
 * somebody just typed. Without discovery, wiring research into Chat would mean
 * either shipping a hardcoded source list or asking a model to invent URLs,
 * and a model inventing URLs is how a citation ends up pointing at a page that
 * does not exist.
 *
 * SO: A SEARCH INDEX, NOT A MODEL. These are the ordinary search endpoints the
 * allowlisted sites publish for anyone to use. They take a string and return
 * titles and URLs from their own index. No inference, no third-party AI
 * service, no credentials, and nothing about the person is sent beyond the
 * words of their question — which is the same thing that would be sent by
 * typing it into that site's own search box.
 *
 * DISCOVERY CANNOT WIDEN SCOPE. Every URL it returns is built from a host
 * already on `ALLOWED_HOSTS`, and the fetcher revalidates against that list
 * regardless of what arrives here, so a compromised or misbehaving search
 * response can at worst produce a candidate that is then refused. The parsers
 * below additionally discard any result whose URL does not resolve back to the
 * host that was asked — a search endpoint that starts returning offsite links
 * is a search endpoint whose results are dropped.
 */

export interface Candidate {
  url: string;
  title: string;
  publishedAt: string | null;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** How many candidates one question is allowed to produce. */
export const MAX_CANDIDATES = 8;

/**
 * MediaWiki's OpenSearch endpoint.
 *
 * Documented, rate-limit friendly, and returns a fixed-shape array rather than
 * HTML to be scraped: `[query, [titles], [descriptions], [urls]]`.
 */
export function wikipediaSearchUrl(query: string, limit = 5): string {
  const params = new URLSearchParams({
    action: "opensearch",
    format: "json",
    search: query,
    limit: String(limit),
    namespace: "0",
  });
  return `https://en.wikipedia.org/w/api.php?${params.toString()}`;
}

/**
 * Parse an OpenSearch response into candidates.
 *
 * Defensive throughout: this is a third party's JSON, and a shape change must
 * produce no candidates rather than an exception that takes the whole answer
 * down. A question with no sources is answered from the device with a note; a
 * thrown parser is a broken Chat.
 */
export function parseWikipediaOpenSearch(payload: unknown, host = "en.wikipedia.org"): Candidate[] {
  if (!Array.isArray(payload) || payload.length < 4) return [];
  const titles = Array.isArray(payload[1]) ? payload[1] : [];
  const urls = Array.isArray(payload[3]) ? payload[3] : [];
  const out: Candidate[] = [];
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const title = titles[i];
    if (typeof url !== "string") continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    // Offsite results are dropped rather than passed on to be refused later.
    if (parsed.protocol !== "https:" || parsed.hostname !== host) continue;
    out.push({
      url: parsed.toString(),
      title: typeof title === "string" && title ? title : parsed.pathname,
      publishedAt: null,
    });
  }
  return out;
}

/**
 * Ask the allowlisted indexes what they have on this question.
 *
 * Every failure is swallowed into "no candidates": a search endpoint being
 * slow, rate limited or offline must degrade Chat to answering from the device
 * with a note, never into an error the person has to read.
 */
export async function discoverCandidates(
  query: string,
  options: { fetch?: FetchLike; limit?: number; signal?: AbortSignal } = {},
): Promise<Candidate[]> {
  const doFetch = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
  if (!doFetch) return [];
  const trimmed = query.trim().slice(0, 300);
  if (trimmed.length < 3) return [];

  try {
    const response = await doFetch(wikipediaSearchUrl(trimmed), {
      headers: { accept: "application/json" },
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (!response.ok) return [];
    const payload: unknown = await response.json();
    return parseWikipediaOpenSearch(payload).slice(0, options.limit ?? MAX_CANDIDATES);
  } catch {
    return [];
  }
}
