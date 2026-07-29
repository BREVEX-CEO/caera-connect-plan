import { describe, it, expect } from "vitest";
import { runResearch, type SourceFetcher, type ResearchRunInput } from "../research/research-run";
import { ResearchCache } from "../research/research-cache";
import type { SourceRecord } from "../research/source-ranking";

const NOW = new Date("2026-07-24T12:00:00Z");

const src = (
  publisher: string,
  kind: SourceRecord["kind"],
  authoritativeFor?: string[],
): SourceRecord => ({
  id: publisher,
  title: `${publisher} report`,
  publisher,
  kind,
  publishedAt: NOW,
  retrievedAt: NOW,
  authoritativeFor,
});

const official = src("Agency", "official", ["transport"]);
const news = src("Newsroom", "news");

/** A fetcher scripted per source. */
function scripted(
  map: Record<
    string,
    Parameters<SourceFetcher>[1] extends never
      ? never
      : { result: "ok" | "transient" | "hard"; findings?: string }
  >,
): SourceFetcher {
  return async (_q, source) => {
    const r = map[source.publisher] ?? { result: "hard" as const };
    return { ...r, publishedAt: NOW };
  };
}

const base = (over: Partial<ResearchRunInput> = {}): ResearchRunInput => ({
  query: "What is the road status?",
  topic: "transport",
  candidateSources: [official, news],
  fetcher: scripted({ Agency: { result: "ok", findings: "The A38 is clear." } }),
  volatility: "hourly",
  now: NOW,
  ...over,
});

describe("the research pipeline composes the pieces honestly", () => {
  it("checks a second independent source rather than calling one result corroborated", async () => {
    const r = await runResearch(base());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.subAnswers).toHaveLength(1);
    expect(r.data.subAnswers[0].status).toBe("answered");
    expect(r.data.subAnswers[0].sources).toEqual(["Agency"]);
    expect(r.data.subAnswers[0].confidence).toBe("single_source");
    expect(r.data.complete).toBe(true);
  });

  it("reports two genuinely independent confirmations", async () => {
    const r = await runResearch(
      base({
        fetcher: scripted({
          Agency: { result: "ok", findings: "The A38 is clear." },
          Newsroom: { result: "ok", findings: "The A38 is clear." },
        }),
      }),
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.subAnswers[0].sources).toEqual(["Agency", "Newsroom"]);
    expect(r.data.subAnswers[0].confidence).toBe("well_supported");
  });

  it("surfaces an explicit contradiction and does not call the run complete", async () => {
    const fetcher: SourceFetcher = async (_q, source) =>
      source.publisher === "Agency"
        ? { result: "ok", findings: "The bridge is open.", relation: "supports", publishedAt: NOW }
        : {
            result: "ok",
            findings: "The bridge is closed.",
            relation: "contradicts",
            publishedAt: NOW,
          };
    const r = await runResearch(base({ fetcher }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.subAnswers[0].status).toBe("contested");
    expect(r.data.subAnswers[0].confidence).toBe("contested");
    expect(r.data.subAnswers[0].sources).toEqual(["Agency", "Newsroom"]);
    expect(r.data.complete).toBe(false);
    expect(r.data.subAnswers[0].note).toMatch(/disagree/i);
  });

  it("decomposes a compound query and answers each part", async () => {
    const r = await runResearch(
      base({
        query: "What is the road status? Is the bridge open?",
        fetcher: scripted({ Agency: { result: "ok", findings: "Answer." } }),
      }),
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.subAnswers).toHaveLength(2);
  });

  /** Best-authority-first: a hard failure on Agency falls back to Newsroom. */
  it("falls back to the next source on a hard failure", async () => {
    const r = await runResearch(
      base({
        fetcher: scripted({
          Agency: { result: "hard" },
          Newsroom: { result: "ok", findings: "From news." },
        }),
      }),
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.subAnswers[0].sources).toEqual(["Newsroom"]);
  });

  it("retries a transient failure before falling back", async () => {
    // Agency fails transiently once then succeeds; must NOT fall back to news.
    let agencyCalls = 0;
    const fetcher: SourceFetcher = async (_q, s) => {
      if (s.publisher === "Agency") {
        agencyCalls++;
        return agencyCalls === 1
          ? { result: "transient" }
          : { result: "ok", findings: "Recovered.", publishedAt: NOW };
      }
      return { result: "ok", findings: "News.", publishedAt: NOW };
    };
    const r = await runResearch(base({ fetcher }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.subAnswers[0].sources).toEqual(["Agency", "Newsroom"]);
    expect(agencyCalls).toBe(2);
  });

  /**
   * The honest outcome: every adequate source fails → unconfirmed, never a
   * manufactured answer.
   */
  it("reports unconfirmed when every source fails", async () => {
    const r = await runResearch(
      base({ fetcher: scripted({ Agency: { result: "hard" }, Newsroom: { result: "hard" } }) }),
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.subAnswers[0].status).toBe("unconfirmed");
    expect(r.data.subAnswers[0].findings).toBeNull();
    expect(r.data.complete).toBe(false);
    expect(r.data.subAnswers[0].note).toMatch(/couldn't confirm|won't invent/i);
  });
});

describe("caching is honoured through the pipeline", () => {
  it("serves a fresh cache hit without fetching, and labels it", async () => {
    const cache = new ResearchCache();
    let fetches = 0;
    const counting: SourceFetcher = async () => {
      fetches++;
      return { result: "ok", findings: "fetched", publishedAt: NOW };
    };

    // First run populates the cache.
    await runResearch(base({ cache, fetcher: counting }));
    expect(fetches).toBe(2);

    // Second run within the freshness window serves from cache, no fetch.
    const second = await runResearch(
      base({ cache, fetcher: counting, now: new Date(NOW.getTime() + 60_000) }),
    );
    if (!second.ok) throw new Error("unreachable");
    expect(fetches).toBe(2); // unchanged
    expect(second.data.subAnswers[0].status).toBe("cached");
    expect(second.data.subAnswers[0].note).toMatch(/from cache/i);
  });

  /** A stale entry must trigger a re-fetch, not be served as current. */
  it("re-fetches when the cached entry is stale", async () => {
    const cache = new ResearchCache();
    let fetches = 0;
    const counting: SourceFetcher = async () => {
      fetches++;
      return { result: "ok", findings: "fetched", publishedAt: NOW };
    };

    await runResearch(base({ cache, fetcher: counting, volatility: "realtime" }));
    expect(fetches).toBe(2);

    // 60s later, past the 30s realtime window → re-fetch.
    const later = new Date(NOW.getTime() + 60_000);
    const second = await runResearch(
      base({ cache, fetcher: counting, volatility: "realtime", now: later }),
    );
    if (!second.ok) throw new Error("unreachable");
    expect(fetches).toBe(4);
    expect(second.data.subAnswers[0].status).toBe("answered");
  });
});

describe("guards", () => {
  it("refuses an empty query", async () => {
    expect((await runResearch(base({ query: "  " }))).ok).toBe(false);
  });

  it("reports unconfirmed when no source meets the authority floor", async () => {
    const r = await runResearch(base({ candidateSources: [src("Forum", "social")] }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.subAnswers[0].status).toBe("unconfirmed");
  });

  it("stops promptly when the caller cancels", async () => {
    const controller = new AbortController();
    const fetcher: SourceFetcher = async () => new Promise(() => undefined);
    const running = runResearch(
      base({ fetcher, signal: controller.signal, attemptTimeoutMs: 5_000 }),
    );
    await Promise.resolve();
    controller.abort();
    const r = await running;
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/cancel/i);
  });

  it("bounds a fetcher that never settles", async () => {
    const fetcher: SourceFetcher = async () => new Promise(() => undefined);
    const started = Date.now();
    const r = await runResearch(base({ fetcher, attemptTimeoutMs: 10, maxAttemptsPerSubquery: 1 }));
    expect(Date.now() - started).toBeLessThan(1_000);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.subAnswers[0].status).toBe("unconfirmed");
  });

  it("refuses pathological query and source budgets", async () => {
    expect((await runResearch(base({ query: "x".repeat(2_001) }))).ok).toBe(false);
    expect((await runResearch(base({ maxAttemptsPerSubquery: 0 }))).ok).toBe(false);
  });
});
