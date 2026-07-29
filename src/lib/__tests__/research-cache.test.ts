import { describe, it, expect } from "vitest";
import {
  decomposeQuery,
  packetFreshness,
  ResearchCache,
  type ResearchPacket,
} from "../research/research-cache";

const NOW = new Date("2026-07-24T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const packet = (over: Partial<ResearchPacket> = {}): ResearchPacket => ({
  key: ResearchCache.keyFor("what is the capital of france"),
  findings: "Paris.",
  sources: ["encyclopaedia"],
  volatility: "stable",
  fetchedAt: ago(0),
  ...over,
});

describe("query decomposition is conservative", () => {
  it("leaves a single question alone", () => {
    const r = decomposeQuery("What is the weather today?");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(1);
  });

  it("splits genuine multi-part questions", () => {
    const r = decomposeQuery("What is the weather today? What time is sunset?");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(2);
  });

  it("splits on 'and' only between real sub-questions", () => {
    const joined = decomposeQuery("What is the deadline and how do I submit?");
    const notJoined = decomposeQuery("Tell me about cats and dogs");
    if (!joined.ok || !notJoined.ok) throw new Error("unreachable");
    expect(joined.data).toHaveLength(2);
    // "cats and dogs" is one topic, not two questions — must not over-split.
    expect(notJoined.data).toHaveLength(1);
  });

  it("refuses an empty query", () => {
    expect(decomposeQuery("  ").ok).toBe(false);
  });
});

describe("freshness is per-subject", () => {
  it("a realtime packet goes stale in seconds", () => {
    const r = packetFreshness(packet({ volatility: "realtime", fetchedAt: ago(60_000) }), NOW);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.fresh).toBe(false);
  });

  it("a stable packet is still fresh after an hour", () => {
    const r = packetFreshness(packet({ volatility: "stable", fetchedAt: ago(60 * 60_000) }), NOW);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.fresh).toBe(true);
  });

  /**
   * The same age gives opposite verdicts depending on subject — which is the
   * whole point of per-subject freshness.
   */
  it("judges the same age differently by volatility", () => {
    const age = 5 * 60_000; // 5 minutes
    const realtime = packetFreshness(packet({ volatility: "realtime", fetchedAt: ago(age) }), NOW);
    const hourly = packetFreshness(packet({ volatility: "hourly", fetchedAt: ago(age) }), NOW);
    if (!realtime.ok || !hourly.ok) throw new Error("unreachable");
    expect(realtime.data.fresh).toBe(false);
    expect(hourly.data.fresh).toBe(true);
  });

  it("rejects a future-dated packet", () => {
    expect(
      packetFreshness(packet({ fetchedAt: new Date(NOW.getTime() + 1000).toISOString() }), NOW).ok,
    ).toBe(false);
  });
});

describe("the cache honours expiry", () => {
  it("stores and serves a fresh packet", () => {
    const cache = new ResearchCache();
    cache.put(packet());
    const r = cache.lookup("What is the capital of France?", NOW);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.status).toBe("fresh");
    expect(r.data.packet?.findings).toBe("Paris.");
  });

  it("normalises trivial query variations to one packet", () => {
    const cache = new ResearchCache();
    cache.put(packet());
    // Different case, trailing punctuation, spacing.
    const r = cache.lookup("  WHAT is the CAPITAL of france ", NOW);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.status).toBe("fresh");
  });

  /**
   * The rule that matters: a stale packet is never served as the current
   * answer. It's reported stale so the caller re-fetches.
   */
  it("reports a stale packet as stale rather than serving it", () => {
    const cache = new ResearchCache();
    cache.put(packet({ volatility: "realtime", fetchedAt: ago(0) }));
    const later = new Date(NOW.getTime() + 60_000); // 1 min later, past 30s TTL
    const r = cache.lookup("What is the capital of France?", later);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.status).toBe("stale");
    expect(r.evidence).toMatch(/won't serve it as current/i);
  });

  it("reports a miss for something never cached", () => {
    const r = new ResearchCache().lookup("anything", NOW);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.status).toBe("miss");
  });

  /** A citation-free packet can't be trusted later, so it isn't cached. */
  it("refuses to cache findings with no sources", () => {
    expect(new ResearchCache().put(packet({ sources: [] })).ok).toBe(false);
    expect(new ResearchCache().put(packet({ findings: "   " })).ok).toBe(false);
  });

  it("evicts stale packets on request", () => {
    const cache = new ResearchCache();
    cache.put(packet({ key: "a", volatility: "realtime", fetchedAt: ago(0) }));
    cache.put(packet({ key: "b", volatility: "stable", fetchedAt: ago(0) }));
    const later = new Date(NOW.getTime() + 60_000);
    const removed = cache.evictStale(later);
    expect(removed).toBe(1); // only the realtime one expired
    expect(cache.size()).toBe(1);
  });

  it("is bounded and evicts the least-recently-used packet", () => {
    const cache = new ResearchCache({ maxEntries: 2 });
    cache.put(packet({ key: "a" }));
    cache.put(packet({ key: "b" }));
    cache.lookup("a", NOW);
    cache.put(packet({ key: "c" }));
    const a = cache.lookup("a", NOW);
    const b = cache.lookup("b", NOW);
    if (!a.ok || !b.ok) throw new Error("unreachable");
    expect(a.data.status).toBe("fresh");
    expect(b.data.status).toBe("miss");
  });

  it("refuses malformed packets instead of poisoning later reads", () => {
    const cache = new ResearchCache();
    expect(cache.put(packet({ key: "   " })).ok).toBe(false);
    expect(cache.put(packet({ fetchedAt: "not-a-date" })).ok).toBe(false);
    expect(cache.put(packet({ sources: ["", "Agency"] })).ok).toBe(false);
  });

  it("refuses oversized queries, findings, and source lists", () => {
    const cache = new ResearchCache({
      maxKeyCharacters: 10,
      maxFindingCharacters: 20,
      maxSources: 2,
      maxSourceCharacters: 10,
    });
    expect(cache.put(packet({ key: "x".repeat(11) })).ok).toBe(false);
    expect(cache.put(packet({ findings: "x".repeat(21) })).ok).toBe(false);
    expect(cache.put(packet({ sources: ["a", "b", "c"] })).ok).toBe(false);
    expect(cache.put(packet({ sources: ["x".repeat(11)] })).ok).toBe(false);
    expect(cache.lookup("x".repeat(11), NOW).ok).toBe(false);
  });

  it("evicts least-recent packets until the total character budget fits", () => {
    const cache = new ResearchCache({
      maxEntries: 10,
      maxTotalCharacters: 35,
    });
    expect(cache.put(packet({ key: "a", findings: "a".repeat(10), sources: ["one"] })).ok).toBe(
      true,
    );
    expect(cache.put(packet({ key: "b", findings: "b".repeat(10), sources: ["two"] })).ok).toBe(
      true,
    );
    expect(cache.put(packet({ key: "c", findings: "c".repeat(10), sources: ["three"] })).ok).toBe(
      true,
    );
    const evicted = cache.lookup("a", NOW);
    if (!evicted.ok) throw new Error("unreachable");
    expect(evicted.data).toMatchObject({ status: "miss" });
    expect(cache.size()).toBeLessThan(3);
  });
});
