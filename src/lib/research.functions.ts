/**
 * Research server functions (P21 production wiring).
 *
 * `runResearch`, `createHttpSourceFetcher`, `ResearchCache` and the fallback
 * planner were complete, tested — and imported only by tests. Four modules of
 * a working research pipeline with no way to reach it.
 *
 * They belong on the SERVER, not in the browser, for two reasons that are not
 * about convenience:
 *
 *  1. The browser cannot fetch arbitrary origins. A research run driven from
 *     the client would be silently shaped by CORS rather than by the source
 *     ranking, and would report "no sources" for reasons unrelated to the
 *     sources.
 *  2. `validateResearchUrl` is an SSRF guard, and an SSRF guard that runs in
 *     the client protects nothing — the attacker controls the client. It has
 *     to run where the request is actually made.
 *
 * The allowlist is therefore built here and never accepted from the caller.
 */
import { createServerFn } from "@tanstack/react-start";
import { discoverCandidates } from "./research/candidate-discovery";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runResearch, type ResearchResult } from "@/lib/research/research-run";
import { createHttpSourceFetcher } from "@/lib/research/http-source";
import { ResearchCache, type Volatility } from "@/lib/research/research-cache";
import type { SourceRecord, SourceKind } from "@/lib/research/source-ranking";

/**
 * Hosts a research run may reach.
 *
 * Server-side and hard-coded on purpose. Letting the caller supply this would
 * turn the SSRF guard into decoration: a client that can name its own allowed
 * host can name the metadata endpoint.
 */
const ALLOWED_HOSTS = [
  "en.wikipedia.org",
  "www.gov.uk",
  "developer.mozilla.org",
  "docs.python.org",
  "nvd.nist.gov",
] as const;

/**
 * What kind of source each allowed host is.
 *
 * Ranking weights `official` above `aggregator`, so this is a claim with
 * consequences and it is only made for hosts on our own allowlist — where we
 * genuinely do know the answer. Anything else is `unknown`, which ranks
 * conservatively. Guessing "official" for an unrecognised host would let a
 * caller promote its own source by naming it.
 */
const HOST_KIND: Readonly<Record<string, SourceKind>> = {
  "gov.uk": "official",
  "nvd.nist.gov": "official",
  "developer.mozilla.org": "primary_party",
  "docs.python.org": "primary_party",
  "en.wikipedia.org": "aggregator",
};

/**
 * One cache for the server process, keyed by query. Bounded by the cache's own
 * policy; research answers go stale, and a cache that never expires would
 * serve yesterday's answer to a question about today.
 */
const cache = new ResearchCache();

const researchInput = z.object({
  query: z.string().min(3).max(500),
  topic: z.string().min(1).max(120),
  volatility: z.enum(["realtime", "hourly", "daily", "stable"]).default("daily"),
  /**
   * Candidate sources are supplied by the caller but constrained here: the
   * fetcher will refuse any URL outside ALLOWED_HOSTS regardless of what
   * arrives, so this list can only ever narrow the run, never widen it.
   */
  candidates: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        title: z.string().max(300).default(""),
        publishedAt: z.string().datetime().nullable().default(null),
      }),
    )
    .max(20)
    .default([]),
});

/** A source as the answer will cite it. Returned so the caller need not guess. */
export interface ResearchSource {
  title: string;
  url: string;
  asOf: string | null;
}

export type ResearchRunResponse =
  | {
      ok: true;
      result: ResearchResult;
      allowedHosts: string[];
      /**
       * The sources actually read, in the order the answer should number them.
       *
       * Returned rather than left to the caller to reconstruct, because a
       * caller reconstructing them from the candidate list it sent would cite
       * pages the run never actually fetched — a citation naming a source the
       * model never saw is worse than no citation.
       */
      sources: ResearchSource[];
    }
  | { ok: false; reason: string; allowedHosts: string[] };

export const runResearchQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => researchInput.parse(raw))
  .handler(async ({ data }): Promise<ResearchRunResponse> => {
    const allowedHosts = [...ALLOWED_HOSTS];

    /*
     * Build complete SourceRecords rather than casting a partial object.
     *
     * `publisher` is derived from the URL host because source ranking uses it
     * to detect the same outlet cited twice; leaving it blank would make five
     * pages from one site look like five independent corroborations. That is
     * the specific failure a cast would have hidden here.
     *
     * `retrievedAt` is when OCADE is about to read it — never inferred from
     * publishedAt, which is what the source claims about itself.
     */
    const retrievedAt = new Date();

    /*
     * DISCOVER CANDIDATES WHEN THE CALLER HAS NONE.
     *
     * The only caller used to be the research panel, which passes two
     * hardcoded URLs about flood warnings — fine for a demonstration, useless
     * for Chat, where the question is whatever somebody just typed. The
     * alternative to discovery is asking a model to invent URLs, and a model
     * inventing URLs is how a citation ends up pointing at a page that does
     * not exist.
     *
     * Discovery cannot widen scope: it queries the allowlisted sites' own
     * search indexes, and the fetcher revalidates every URL against
     * ALLOWED_HOSTS regardless of what comes back.
     */
    const supplied =
      data.candidates.length > 0 ? data.candidates : await discoverCandidates(data.query);

    const candidateSources: SourceRecord[] = supplied.map((c, i) => {
      let publisher: string;
      try {
        publisher = new URL(c.url).hostname.replace(/^www\./, "");
      } catch {
        publisher = "unknown";
      }
      return {
        id: `cand-${i}-${publisher}`,
        title: c.title || c.url,
        url: c.url,
        publisher,
        kind: HOST_KIND[publisher] ?? "unknown",
        publishedAt: c.publishedAt ? new Date(c.publishedAt) : null,
        retrievedAt,
      };
    });

    if (candidateSources.length === 0) {
      // An empty run is a refusal, not an empty success. Returning ok:true with
      // no sources would read as "nothing exists" rather than "nothing asked".
      return {
        ok: false,
        reason: "No candidate source could be found for that question.",
        allowedHosts,
      };
    }

    const fetcher = createHttpSourceFetcher({ allowedHosts });

    const outcome = await runResearch({
      query: data.query,
      topic: data.topic,
      candidateSources,
      fetcher,
      volatility: data.volatility as Volatility,
      cache,
    });

    return outcome.ok
      ? {
          ok: true,
          result: outcome.data,
          allowedHosts,
          /*
           * A SourceRecord's `url` is optional — some source kinds have none —
           * so sources without one are dropped rather than cited as a link
           * that goes nowhere.
           */
          sources: candidateSources
            .filter((source): source is SourceRecord & { url: string } => Boolean(source.url))
            .map((source) => ({
              title: source.title,
              url: source.url,
              asOf: source.publishedAt ? source.publishedAt.toISOString().slice(0, 10) : null,
            })),
        }
      : { ok: false, reason: outcome.reason, allowedHosts };
  });
