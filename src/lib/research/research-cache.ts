/**
 * Subject-aware, bounded research cache.
 *
 * Freshness is tied to the volatility of the subject. Stale packets are
 * reported but never served as current, and malformed or citation-free packets
 * never enter the cache.
 */
export type Volatility = "realtime" | "hourly" | "daily" | "stable";

const TTL_MS: Record<Volatility, number> = {
  realtime: 30 * 1_000,
  hourly: 60 * 60 * 1_000,
  daily: 24 * 60 * 60 * 1_000,
  stable: 30 * 24 * 60 * 60 * 1_000,
};

export interface ResearchPacket {
  key: string;
  findings: string;
  sources: string[];
  volatility: Volatility;
  fetchedAt: string;
}

export type CacheOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface ResearchCacheOptions {
  maxEntries?: number;
  maxKeyCharacters?: number;
  maxFindingCharacters?: number;
  maxSources?: number;
  maxSourceCharacters?: number;
  maxTotalCharacters?: number;
}

const CACHE_DEFAULTS = {
  maxEntries: 100,
  maxKeyCharacters: 2_000,
  maxFindingCharacters: 100_000,
  maxSources: 50,
  maxSourceCharacters: 2_000,
  maxTotalCharacters: 2_000_000,
};

export function decomposeQuery(query: string): CacheOutcome<string[]> {
  if (typeof query !== "string" || query.length > CACHE_DEFAULTS.maxKeyCharacters) {
    return {
      ok: false,
      reason: `Research queries are limited to ${CACHE_DEFAULTS.maxKeyCharacters} characters.`,
    };
  }
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, reason: "There's no query to decompose." };

  const byQuestion = trimmed
    .split(/(?<=\?)\s+/)
    .flatMap((part) =>
      part.split(/\s*;\s*|\s+\band\b\s+(?=(?:what|why|how|when|where|who|is|are|does|do|can)\b)/i),
    )
    .map((part) => part.trim())
    .filter(Boolean);

  const parts = byQuestion.length > 0 ? byQuestion : [trimmed];
  return {
    ok: true,
    data: parts,
    evidence:
      parts.length === 1
        ? "A single question; no decomposition needed."
        : `Decomposed into ${parts.length} sub-questions.`,
  };
}

export interface Freshness {
  ageMs: number;
  ttlMs: number;
  fresh: boolean;
  label: string;
}

export function packetFreshness(
  packet: ResearchPacket,
  now: Date = new Date(),
): CacheOutcome<Freshness> {
  const fetched = Date.parse(packet.fetchedAt);
  if (Number.isNaN(fetched)) {
    return { ok: false, reason: "This packet has an unreadable fetch time." };
  }
  if (!Object.prototype.hasOwnProperty.call(TTL_MS, packet.volatility)) {
    return { ok: false, reason: "This packet has an unknown volatility class." };
  }

  const ageMs = now.getTime() - fetched;
  if (ageMs < 0) {
    return { ok: false, reason: "This packet is dated in the future; its time can't be trusted." };
  }

  const ttlMs = TTL_MS[packet.volatility];
  const minutes = Math.floor(ageMs / 60_000);
  const label =
    minutes < 1
      ? "just now"
      : minutes < 60
        ? `${minutes} min ago`
        : `${Math.floor(minutes / 60)} h ago`;
  return {
    ok: true,
    data: { ageMs, ttlMs, fresh: ageMs <= ttlMs, label },
    evidence: `Fetched ${label}.`,
  };
}

export class ResearchCache {
  private store = new Map<string, ResearchPacket>();
  private readonly maxEntries: number;
  private readonly maxKeyCharacters: number;
  private readonly maxFindingCharacters: number;
  private readonly maxSources: number;
  private readonly maxSourceCharacters: number;
  private readonly maxTotalCharacters: number;

  constructor(options: ResearchCacheOptions = {}) {
    this.maxEntries = positiveOption(options.maxEntries, CACHE_DEFAULTS.maxEntries, "entry");
    this.maxKeyCharacters = positiveOption(
      options.maxKeyCharacters,
      CACHE_DEFAULTS.maxKeyCharacters,
      "key character",
    );
    this.maxFindingCharacters = positiveOption(
      options.maxFindingCharacters,
      CACHE_DEFAULTS.maxFindingCharacters,
      "finding character",
    );
    this.maxSources = positiveOption(options.maxSources, CACHE_DEFAULTS.maxSources, "source");
    this.maxSourceCharacters = positiveOption(
      options.maxSourceCharacters,
      CACHE_DEFAULTS.maxSourceCharacters,
      "source character",
    );
    this.maxTotalCharacters = positiveOption(
      options.maxTotalCharacters,
      CACHE_DEFAULTS.maxTotalCharacters,
      "total character",
    );
  }

  static keyFor(query: string): string {
    return query
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[?.!]+$/, "");
  }

  put(packet: ResearchPacket): CacheOutcome<ResearchPacket> {
    if (typeof packet.key !== "string" || packet.key.length > this.maxKeyCharacters) {
      return {
        ok: false,
        reason: `Won't cache a query key over ${this.maxKeyCharacters} characters.`,
      };
    }
    const key = ResearchCache.keyFor(packet.key);
    if (!key) return { ok: false, reason: "Won't cache a packet without a query key." };
    if (
      typeof packet.findings !== "string" ||
      !packet.findings.trim() ||
      packet.findings.length > this.maxFindingCharacters
    ) {
      return {
        ok: false,
        reason: `Won't cache empty findings or findings over ${this.maxFindingCharacters} characters.`,
      };
    }
    if (!Array.isArray(packet.sources)) {
      return { ok: false, reason: "Won't cache a packet with an invalid source list." };
    }
    if (packet.sources.length === 0) {
      return {
        ok: false,
        reason:
          "Won't cache findings with no sources - a citation-free packet can't be trusted later.",
      };
    }
    if (packet.sources.length > this.maxSources) {
      return {
        ok: false,
        reason: `Won't cache more than ${this.maxSources} sources for one packet.`,
      };
    }
    if (packet.sources.some((source) => typeof source !== "string" || !source.trim())) {
      return { ok: false, reason: "Won't cache a packet with an unnamed source." };
    }
    if (packet.sources.some((source) => source.length > this.maxSourceCharacters)) {
      return {
        ok: false,
        reason: `Won't cache a source label over ${this.maxSourceCharacters} characters.`,
      };
    }
    if (!Object.prototype.hasOwnProperty.call(TTL_MS, packet.volatility)) {
      return { ok: false, reason: "Won't cache a packet with an unknown volatility class." };
    }
    if (Number.isNaN(Date.parse(packet.fetchedAt))) {
      return { ok: false, reason: "Won't cache a packet with an unreadable fetch time." };
    }

    const stored: ResearchPacket = {
      ...packet,
      key,
      findings: packet.findings.trim(),
      sources: [...new Set(packet.sources.map((source) => source.trim()))],
    };
    if (packetCharacters(stored) > this.maxTotalCharacters) {
      return {
        ok: false,
        reason: "This research packet exceeds the cache's total character budget by itself.",
      };
    }
    this.store.delete(key);
    this.store.set(key, stored);
    while (this.store.size > this.maxEntries || this.totalCharacters() > this.maxTotalCharacters) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
    return {
      ok: true,
      data: clonePacket(stored),
      evidence: `Cached "${key}" (${packet.volatility}).`,
    };
  }

  lookup(
    query: string,
    now: Date = new Date(),
  ): CacheOutcome<{
    status: "fresh" | "stale" | "miss";
    packet?: ResearchPacket;
    freshness?: Freshness;
  }> {
    if (typeof query !== "string" || query.length > this.maxKeyCharacters) {
      return {
        ok: false,
        reason: `Cache lookups are limited to ${this.maxKeyCharacters} characters.`,
      };
    }
    const key = ResearchCache.keyFor(query);
    const packet = this.store.get(key);
    if (!packet) {
      return {
        ok: true,
        data: { status: "miss" },
        evidence: "Not cached - a fresh fetch is needed.",
      };
    }

    const freshness = packetFreshness(packet, now);
    if (!freshness.ok) return freshness;

    if (freshness.data.fresh) {
      this.store.delete(key);
      this.store.set(key, packet);
      return {
        ok: true,
        data: { status: "fresh", packet: clonePacket(packet), freshness: freshness.data },
        evidence: `Served from cache, fetched ${freshness.data.label}, within its ${describeTtl(packet.volatility)} freshness window.`,
      };
    }

    return {
      ok: true,
      data: { status: "stale", packet: clonePacket(packet), freshness: freshness.data },
      evidence: `Cached answer is ${freshness.data.label}, past its ${describeTtl(packet.volatility)} window. OCADE won't serve it as current - re-fetch, or use it only as a labelled fallback.`,
    };
  }

  evictStale(now: Date = new Date()): number {
    let removed = 0;
    for (const [key, packet] of this.store) {
      const freshness = packetFreshness(packet, now);
      if (!freshness.ok || !freshness.data.fresh) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  size(): number {
    return this.store.size;
  }

  private totalCharacters(): number {
    let total = 0;
    for (const packet of this.store.values()) total += packetCharacters(packet);
    return total;
  }
}

function positiveOption(value: number | undefined, fallback: number, label: string): number {
  const selected = value ?? fallback;
  if (!Number.isInteger(selected) || selected < 1) {
    throw new Error(`Research cache ${label} capacity must be a positive integer.`);
  }
  return selected;
}

function packetCharacters(packet: ResearchPacket): number {
  return (
    packet.key.length +
    packet.findings.length +
    packet.sources.reduce((sum, source) => sum + source.length, 0)
  );
}

function clonePacket(packet: ResearchPacket): ResearchPacket {
  return { ...packet, sources: [...packet.sources] };
}

function describeTtl(volatility: Volatility): string {
  switch (volatility) {
    case "realtime":
      return "30-second";
    case "hourly":
      return "1-hour";
    case "daily":
      return "1-day";
    case "stable":
      return "30-day";
  }
}
