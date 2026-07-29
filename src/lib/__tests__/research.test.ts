import { describe, it, expect } from "vitest";
import {
  freshnessOf,
  authorityFor,
  independentSources,
  rankSources,
  STALE_AFTER_MS,
  type SourceRecord,
} from "../research/source-ranking";
import { assessClaim, assessIncidentClaim, describeAssessment } from "../research/claim-check";

const NOW = new Date("2026-07-23T12:00:00Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60000);

function source(
  over: Partial<SourceRecord> & Pick<SourceRecord, "id" | "publisher">,
): SourceRecord {
  return {
    title: `${over.publisher} report`,
    kind: "news",
    publishedAt: minutesAgo(10),
    retrievedAt: NOW,
    ...over,
  };
}

/* ------------------------------------------------------------- freshness -- */

describe("freshness", () => {
  it("measures age and labels it readably", () => {
    const r = freshnessOf(source({ id: "1", publisher: "A", publishedAt: minutesAgo(90) }), NOW);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.label).toBe("1 h ago");
    expect(r.data.stale).toBe(false);
  });

  /**
   * An undated page is not recent, it is undated — and the difference decides
   * whether an answer about current conditions is worth anything.
   */
  it("refuses to guess an age for an undated source", () => {
    const r = freshnessOf(source({ id: "1", publisher: "A", publishedAt: null }), NOW);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't assume it is/i);
  });

  it("rejects a future timestamp rather than trusting it", () => {
    const r = freshnessOf(
      source({ id: "1", publisher: "A", publishedAt: new Date(NOW.getTime() + 60000) }),
      NOW,
    );
    expect(r.ok).toBe(false);
  });

  it("marks a source past the staleness threshold", () => {
    const old = freshnessOf(
      source({
        id: "1",
        publisher: "A",
        publishedAt: new Date(NOW.getTime() - STALE_AFTER_MS - 1000),
      }),
      NOW,
    );
    if (!old.ok) throw new Error("unreachable");
    expect(old.data.stale).toBe(true);
  });

  it("rejects an invalid Date rather than crashing while rendering it", () => {
    const r = freshnessOf(
      source({ id: "1", publisher: "A", publishedAt: new Date("not-a-date") }),
      NOW,
    );
    expect(r.ok).toBe(false);
  });
});

/* ------------------------------------------------------------- authority -- */

describe("authority is topic-specific", () => {
  const metOffice = source({
    id: "met",
    publisher: "National Weather Service",
    kind: "official",
    authoritativeFor: ["weather", "flooding"],
  });

  it("gives an official body full weight inside its remit", () => {
    expect(authorityFor(metOffice, "weather")).toBe(1);
  });

  /**
   * The case a single global authority score gets exactly wrong: an official
   * body speaking outside its remit is not more reliable than a newsroom that
   * covers the subject.
   */
  it("downgrades the same body outside its remit", () => {
    const inRemit = authorityFor(metOffice, "weather");
    const outOfRemit = authorityFor(metOffice, "football");
    expect(outOfRemit).toBeLessThan(inRemit);
    expect(outOfRemit).toBeLessThan(
      authorityFor(source({ id: "n", publisher: "Newsroom" }), "football"),
    );
  });

  it("ranks social and unknown sources below reporting", () => {
    expect(authorityFor(source({ id: "s", publisher: "P", kind: "social" }), "x")).toBeLessThan(
      authorityFor(source({ id: "n", publisher: "P2", kind: "news" }), "x"),
    );
    expect(authorityFor(source({ id: "u", publisher: "P3", kind: "unknown" }), "x")).toBeLessThan(
      0.3,
    );
  });
});

/* ---------------------------------------------------------- independence -- */

describe("syndication is not corroboration", () => {
  /**
   * Forty outlets carrying one agency story is one source repeated forty
   * times. Counting them separately is how a rumour becomes a fact, and the
   * answer looks exceptionally well-sourced while it happens.
   */
  it("collapses outlets carrying the same wire story to one", () => {
    const wire = [
      source({ id: "1", publisher: "Paper A", originator: "Agency" }),
      source({ id: "2", publisher: "Paper B", originator: "Agency" }),
      source({ id: "3", publisher: "Paper C", originator: "Agency" }),
    ];
    expect(independentSources(wire)).toHaveLength(1);
  });

  it("keeps genuinely separate reporting separate", () => {
    const separate = [
      source({ id: "1", publisher: "Paper A" }),
      source({ id: "2", publisher: "Paper B" }),
    ];
    expect(independentSources(separate)).toHaveLength(2);
  });

  it("treats the same publisher twice as one source", () => {
    const same = [
      source({ id: "1", publisher: "Paper A" }),
      source({ id: "2", publisher: "paper a" }),
    ];
    expect(independentSources(same)).toHaveLength(1);
  });
});

/* --------------------------------------------------------------- ranking -- */

describe("ranking", () => {
  it("puts the authoritative source first and the undated one last", () => {
    const r = rankSources(
      [
        source({ id: "u", publisher: "Blog", kind: "unknown", publishedAt: null }),
        source({ id: "n", publisher: "Newsroom", kind: "news" }),
        source({ id: "o", publisher: "Agency", kind: "official", authoritativeFor: ["transport"] }),
      ],
      "transport",
      NOW,
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data[0].source.id).toBe("o");
    expect(r.data[r.data.length - 1].source.id).toBe("u");
  });

  /** Dropping an undated source would hide that OCADE saw something it couldn't date. */
  it("keeps undated sources and labels them rather than discarding them", () => {
    const r = rankSources([source({ id: "u", publisher: "Blog", publishedAt: null })], "x", NOW);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(1);
    expect(r.data[0].note).toMatch(/undated/i);
    expect(r.evidence).toMatch(/1 undated/);
  });

  it("reports the independent count, not the raw count", () => {
    const r = rankSources(
      [
        source({ id: "1", publisher: "A", originator: "Wire" }),
        source({ id: "2", publisher: "B", originator: "Wire" }),
      ],
      "x",
      NOW,
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/2 sources, 1 independent/);
  });

  it("refuses an empty set", () => {
    expect(rankSources([], "x", NOW).ok).toBe(false);
  });
});

/* ------------------------------------------------------------ assessment -- */

describe("what OCADE may assert", () => {
  const claim = (over: Partial<Parameters<typeof assessClaim>[0]> = {}) =>
    assessClaim(
      {
        text: "The bridge reopened this morning.",
        topic: "transport",
        supporting: [],
        ...over,
      },
      NOW,
    );

  it("states a well-supported claim plainly", () => {
    const a = claim({
      supporting: [
        source({ id: "1", publisher: "Agency", kind: "official", authoritativeFor: ["transport"] }),
        source({ id: "2", publisher: "Newsroom" }),
      ],
    });
    expect(a.confidence).toBe("well_supported");
    expect(a.statement).toBe("The bridge reopened this morning.");
    expect(a.uncertainties).toEqual([]);
  });

  it("refuses to state a claim with no support at all", () => {
    const a = claim();
    expect(a.confidence).toBe("unsupported");
    expect(a.statement).toMatch(/won't state it/i);
  });

  it("marks a single source as unconfirmed, naming it", () => {
    const a = claim({ supporting: [source({ id: "1", publisher: "Newsroom" })] });
    expect(a.confidence).toBe("single_source");
    expect(a.statement).toMatch(/Only Newsroom reports this/);
  });

  /**
   * Disagreement IS the finding. Resolving it by counting would bury the thing
   * the user most needs to know.
   */
  it("reports disagreement rather than picking a side", () => {
    const a = claim({
      supporting: [
        source({ id: "1", publisher: "A" }),
        source({ id: "2", publisher: "B" }),
        source({ id: "3", publisher: "C" }),
      ],
      contradicting: [source({ id: "4", publisher: "Agency", kind: "official" })],
    });
    expect(a.confidence).toBe("contested");
    expect(a.statement).toMatch(/won't pick a side/i);
    expect(a.uncertainties.join(" ")).toMatch(/Contradicted by Agency/);
  });

  it("says out loud when apparent corroboration was syndication", () => {
    const a = claim({
      supporting: [
        source({ id: "1", publisher: "A", originator: "Wire" }),
        source({ id: "2", publisher: "B", originator: "Wire" }),
        source({ id: "3", publisher: "C", originator: "Wire" }),
      ],
    });
    expect(a.independentSupport).toBe(1);
    expect(a.uncertainties.join(" ")).toMatch(/same reporting republished/i);
  });

  it("flags that the freshest source is already stale", () => {
    const a = claim({
      supporting: [
        source({
          id: "1",
          publisher: "A",
          publishedAt: new Date(NOW.getTime() - STALE_AFTER_MS - 1),
        }),
        source({
          id: "2",
          publisher: "B",
          publishedAt: new Date(NOW.getTime() - STALE_AFTER_MS - 2),
        }),
      ],
    });
    expect(a.uncertainties.join(" ")).toMatch(/may no longer hold/i);
    expect(a.confidence).toBe("supported");
  });

  it("carries the timestamp and caveats into the line shown to the user", () => {
    const a = claim({ supporting: [source({ id: "1", publisher: "Newsroom" })] });
    const line = describeAssessment(a);
    expect(line).toMatch(/unconfirmed/i);
    expect(line).toMatch(/Most recent source dated 2026-07-23/);
  });
});

/* -------------------------------------------------------------- incidents -- */

/**
 * The strictest rule in the module. Red on a traffic map means vehicles are
 * slow. It does not mean a crash — and reporting one is inventing the most
 * alarming explanation for an ambiguous signal, phrased as observation.
 */
describe("incidents are never inferred from sensors", () => {
  const trafficLayer = source({ id: "t", publisher: "Live traffic layer", kind: "sensor" });
  const satellite = source({ id: "s", publisher: "Satellite imagery", kind: "sensor" });

  it("REFUSES to report an accident from a red traffic layer", () => {
    const r = assessIncidentClaim(
      { kind: "accident", text: "a collision", location: "the A38", sources: [trafficLayer] },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't report an accident from traffic or imagery data/i);
  });

  it("refuses however many sensors agree", () => {
    const r = assessIncidentClaim(
      {
        kind: "accident",
        text: "a collision",
        location: "the A38",
        sources: [
          trafficLayer,
          satellite,
          source({ id: "s2", publisher: "Another feed", kind: "sensor" }),
        ],
      },
      NOW,
    );
    expect(r.ok).toBe(false);
  });

  it("refuses casualty and cause claims on the same basis", () => {
    for (const kind of ["casualty", "cause", "emergency"] as const) {
      const r = assessIncidentClaim(
        { kind, text: "something", location: "the A38", sources: [trafficLayer] },
        NOW,
      );
      expect(r.ok, kind).toBe(false);
    }
  });

  /**
   * The refusal has to leave something true to say. Otherwise the caller is
   * left with nothing and reaches for the inference anyway.
   */
  it("offers the honest observation the data actually supports", () => {
    const r = assessIncidentClaim(
      { kind: "accident", text: "a collision", location: "the A38", sources: [trafficLayer] },
      NOW,
    );
    if (r.ok) throw new Error("unreachable");
    expect(r.mayInsteadSay).toMatch(/moving slowly/i);
    expect(r.mayInsteadSay).toMatch(/does not say why/i);
    expect(r.mayInsteadSay).toMatch(/Roadworks, an event, weather or a sensor fault/i);
    // And it must not contain the word it refused to assert.
    expect(r.mayInsteadSay).not.toMatch(/collision|accident|crash/i);
  });

  it("points the user at who would actually know", () => {
    const r = assessIncidentClaim(
      { kind: "accident", text: "a collision", location: "the A38", sources: [trafficLayer] },
      NOW,
    );
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/emergency service or traffic authority/i);
  });

  it("states the incident when an official source reports it", () => {
    const r = assessIncidentClaim(
      {
        kind: "accident",
        text: "a collision",
        location: "the A38",
        sources: [
          trafficLayer,
          source({
            id: "p",
            publisher: "Highways Agency",
            kind: "official",
            publishedAt: minutesAgo(15),
          }),
        ],
      },
      NOW,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.statement).toMatch(/Highways Agency reports a collision/);
    expect(r.statement).toMatch(/as of 15 min ago/);
    expect(r.asOf).toBe(minutesAgo(15).toISOString());
  });

  it("refuses an official report that carries no timestamp", () => {
    const r = assessIncidentClaim(
      {
        kind: "emergency",
        text: "a fire",
        location: "Mill Lane",
        sources: [
          source({ id: "p", publisher: "Fire Service", kind: "official", publishedAt: null }),
        ],
      },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/can't be presented as current/i);
    expect(r.mayInsteadSay).toMatch(/check it directly/i);
  });

  it("refuses a stale official report and says it may be resolved", () => {
    const r = assessIncidentClaim(
      {
        kind: "closure",
        text: "a road closure",
        location: "Mill Lane",
        sources: [
          source({
            id: "p",
            publisher: "Council",
            kind: "official",
            publishedAt: new Date(NOW.getTime() - STALE_AFTER_MS - 1000),
          }),
        ],
      },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.mayInsteadSay).toMatch(/may well be resolved/i);
  });

  it("says plainly when there is nothing at all", () => {
    const r = assessIncidentClaim(
      { kind: "accident", text: "a collision", location: "the A38", sources: [] },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.mayInsteadSay).toMatch(/no official information/i);
  });
});
