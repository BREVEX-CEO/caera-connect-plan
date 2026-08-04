/**
 * OCADE Research — judging sources.
 *
 * Fetching pages is the easy half of research and the half that needs a
 * network. This module is the other half: deciding which of the things you
 * fetched are worth believing, and how much. It is pure, so it is testable, and
 * it is where every honesty rule for research actually lives.
 *
 * Three ideas shape it:
 *
 *  1. **A source with no timestamp cannot be ranked for freshness.** It is not
 *     "probably recent". Guessing here is how a two-year-old page becomes the
 *     basis for an answer about today.
 *
 *  2. **Syndication is not corroboration.** Forty outlets running the same wire
 *     copy is one source repeated forty times. Counting them as forty
 *     independent confirmations is the single most common way an agent turns a
 *     rumour into a fact — and the resulting answer looks exceptionally
 *     well-sourced.
 *
 *  3. **Authority is domain-specific.** A national meteorological office is
 *     authoritative about weather and not about football transfers. A ranking
 *     that treats authority as a single global score gets this exactly wrong in
 *     the cases people rely on most.
 */

export type SourceKind =
  /** Government, regulator, emergency service, standards body. */
  | "official"
  /** The organisation the claim is about, speaking about itself. */
  | "primary_party"
  /** Newsroom with an accountable masthead. */
  | "news"
  /** Wire service whose copy is republished verbatim elsewhere. */
  | "wire"
  /** Aggregator or index that republishes without adding reporting. */
  | "aggregator"
  /** Social post, forum, or user-generated content. */
  | "social"
  /** Automated feed: traffic layers, sensor networks, satellite imagery. */
  | "sensor"
  | "unknown";

export interface SourceRecord {
  id: string;
  title: string;
  /** Canonical acquisition URL. Optional for offline/imported evidence. */
  url?: string;
  /** Publisher's canonical name. Used to detect the same outlet twice. */
  publisher: string;
  /**
   * The organisation whose reporting this ultimately is. Two outlets carrying
   * the same agency story share an `originator`, and count once.
   */
  originator?: string;
  kind: SourceKind;
  /** When the source says it was published. Null when it doesn't say. */
  publishedAt: Date | null;
  /** When OCADE actually read it. Never inferred. */
  retrievedAt: Date;
  /** Topics this publisher is accountable for, e.g. ["weather", "flooding"]. */
  authoritativeFor?: string[];
}

export type RankOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

/* -------------------------------------------------------------- freshness -- */

export interface Freshness {
  ageMs: number;
  /** Plain-language age, for showing beside a claim. */
  label: string;
  /** True when the source is old enough that "current" would be misleading. */
  stale: boolean;
}

/** Beyond this, a source is not evidence about "right now". */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * How old a source is.
 *
 * Refuses rather than assuming when the source carries no date: an undated page
 * is not recent, it is undated, and the difference decides whether an answer
 * about current conditions is worth anything.
 */
export function freshnessOf(source: SourceRecord, now: Date = new Date()): RankOutcome<Freshness> {
  if (!source.publishedAt) {
    return {
      ok: false,
      reason: `“${source.title}” doesn't say when it was published, so OCADE can't tell you whether it's current. It won't assume it is.`,
    };
  }

  if (!Number.isFinite(source.publishedAt.getTime())) {
    return {
      ok: false,
      reason: `"${source.title}" has an unreadable publication date, so its timestamp can't be trusted.`,
    };
  }

  const ageMs = now.getTime() - source.publishedAt.getTime();
  if (ageMs < 0) {
    return {
      ok: false,
      reason: `“${source.title}” is dated in the future, so its timestamp can't be trusted.`,
    };
  }

  const minutes = Math.floor(ageMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const label =
    minutes < 1
      ? "just now"
      : minutes < 60
        ? `${minutes} min ago`
        : hours < 24
          ? `${hours} h ago`
          : `${days} d ago`;

  return {
    ok: true,
    data: { ageMs, label, stale: ageMs > STALE_AFTER_MS },
    evidence: `Published ${label}, read ${source.retrievedAt.toISOString()}.`,
  };
}

/* -------------------------------------------------------------- authority -- */

/**
 * Base weight per kind. Ordering, not precision — the gaps matter, the exact
 * numbers do not, and nothing downstream reports these as a score to the user.
 */
const KIND_WEIGHT: Record<SourceKind, number> = {
  official: 1.0,
  primary_party: 0.85,
  news: 0.7,
  wire: 0.7,
  aggregator: 0.4,
  social: 0.25,
  // Sensors are precise about what they measure and silent about why — see
  // `assessIncidentClaim`, which is where that distinction is enforced.
  sensor: 0.5,
  unknown: 0.2,
};

/**
 * How much weight this source carries **on this topic**.
 *
 * A source outside its remit is downgraded, not promoted by its general
 * standing: a health ministry is authoritative on an outbreak and is not
 * authoritative on a football result.
 */
export function authorityFor(source: SourceRecord, topic: string): number {
  const base = KIND_WEIGHT[source.kind];
  const remit = source.authoritativeFor;
  if (!remit || remit.length === 0) return base;

  const inRemit = remit.some((t) => t.toLowerCase() === topic.toLowerCase());
  return inRemit ? base : Math.min(base, 0.5) * 0.6;
}

/* ---------------------------------------------------------- independence -- */

/**
 * Collapse sources that are really the same reporting.
 *
 * Two records are independent only if they come from different publishers AND
 * different originators. Wire copy republished by twenty outlets counts once —
 * which is the whole point.
 */
export function independentSources(sources: SourceRecord[]): SourceRecord[] {
  const seen = new Set<string>();
  const out: SourceRecord[] = [];

  for (const s of sources) {
    // An explicit originator wins: it is the actual author of the reporting.
    const identity = (s.originator ?? s.publisher).trim().toLowerCase();
    if (seen.has(identity)) continue;
    seen.add(identity);
    out.push(s);
  }
  return out;
}

/* ----------------------------------------------------------------- ranking -- */

export interface RankedSource {
  source: SourceRecord;
  freshness: Freshness | null;
  authority: number;
  /** Why this source sits where it does, in one line. */
  note: string;
}

/**
 * Order sources for a topic: authority first, then recency.
 *
 * Undated sources are kept, ranked last, and labelled — dropping them silently
 * would hide from the user that OCADE saw something it couldn't date.
 */
export function rankSources(
  sources: SourceRecord[],
  topic: string,
  now: Date = new Date(),
): RankOutcome<RankedSource[]> {
  if (sources.length === 0) {
    return { ok: false, reason: "There are no sources to rank." };
  }

  const ranked: RankedSource[] = sources.map((source) => {
    const f = freshnessOf(source, now);
    const authority = authorityFor(source, topic);
    return {
      source,
      freshness: f.ok ? f.data : null,
      authority,
      note: f.ok
        ? f.data.stale
          ? `${source.publisher} — ${f.data.label}, too old to describe current conditions.`
          : `${source.publisher} — ${f.data.label}.`
        : `${source.publisher} — undated, so it can't be ranked for recency.`,
    };
  });

  ranked.sort((a, b) => {
    if (b.authority !== a.authority) return b.authority - a.authority;
    // Undated sorts last within the same authority band.
    if (!a.freshness && !b.freshness) return 0;
    if (!a.freshness) return 1;
    if (!b.freshness) return -1;
    return a.freshness.ageMs - b.freshness.ageMs;
  });

  const undated = ranked.filter((r) => !r.freshness).length;
  const independent = independentSources(sources).length;

  return {
    ok: true,
    data: ranked,
    evidence: `${sources.length} source${sources.length === 1 ? "" : "s"}, ${independent} independent${undated > 0 ? `, ${undated} undated` : ""}.`,
  };
}
