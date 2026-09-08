import { describe, expect, it } from "vitest";
import {
  activeIncidents,
  incidentsNote,
  isIncidentImpact,
  isIncidentState,
  openingStateFor,
  pastIncidents,
  upcomingMaintenance,
  type StatusIncident,
} from "../incidents";

/**
 * What a status page is allowed to say, decided without a database.
 *
 * Every test here is about a sentence a visitor reads. The dangerous version of
 * each is not a crash — it is a page that is confidently wrong: next Tuesday's
 * maintenance shown beside a live outage, yesterday's window still announced as
 * current, or an empty list presented as "nothing has ever gone wrong" on a
 * deployment that was not recording anything.
 */

const NOW = Date.parse("2026-09-10T12:00:00.000Z");
const at = (offsetHours: number) => new Date(NOW + offsetHours * 3_600_000).toISOString();

function incident(over: Partial<StatusIncident> & { id: string }): StatusIncident {
  return {
    kind: "incident",
    title: "Something",
    impact: "degraded",
    state: "investigating",
    componentIds: [],
    startedAt: at(-1),
    scheduledEnd: null,
    resolvedAt: null,
    updates: [],
    ...over,
  };
}

describe("what counts as happening now", () => {
  it("includes an unresolved incident that has started", () => {
    const live = activeIncidents([incident({ id: "a" })], NOW);
    expect(live.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("excludes a resolved one", () => {
    const live = activeIncidents(
      [incident({ id: "a", state: "resolved", resolvedAt: at(-0.5) })],
      NOW,
    );
    expect(live).toEqual([]);
  });

  it("excludes maintenance announced for next week", () => {
    // Shown beside a live outage it would make the page cry wolf.
    const live = activeIncidents(
      [
        incident({
          id: "m",
          kind: "maintenance",
          impact: "maintenance",
          state: "scheduled",
          startedAt: at(168),
          scheduledEnd: at(170),
        }),
      ],
      NOW,
    );
    expect(live).toEqual([]);
  });

  it("includes a maintenance window that has started and not ended", () => {
    const live = activeIncidents(
      [
        incident({
          id: "m",
          kind: "maintenance",
          impact: "maintenance",
          startedAt: at(-1),
          scheduledEnd: at(1),
        }),
      ],
      NOW,
    );
    expect(live.map((entry) => entry.id)).toEqual(["m"]);
  });

  it("stops calling a maintenance window current once its end has passed", () => {
    // Even with nobody having closed it. A page still announcing yesterday's
    // window is a page nobody trusts.
    const live = activeIncidents(
      [
        incident({
          id: "m",
          kind: "maintenance",
          impact: "maintenance",
          startedAt: at(-5),
          scheduledEnd: at(-3),
        }),
      ],
      NOW,
    );
    expect(live).toEqual([]);
  });

  it("keeps an unresolved INCIDENT current past any expectation", () => {
    // An outage does not end because somebody expected it to.
    const live = activeIncidents(
      [incident({ id: "a", startedAt: at(-72), scheduledEnd: at(-70) })],
      NOW,
    );
    expect(live.map((entry) => entry.id)).toEqual(["a"]);
  });
});

describe("announced but not started", () => {
  it("lists future maintenance, soonest first", () => {
    const upcoming = upcomingMaintenance(
      [
        incident({ id: "later", kind: "maintenance", impact: "maintenance", startedAt: at(48) }),
        incident({ id: "sooner", kind: "maintenance", impact: "maintenance", startedAt: at(24) }),
      ],
      NOW,
    );
    expect(upcoming.map((entry) => entry.id)).toEqual(["sooner", "later"]);
  });

  it("does not list a future incident, which is not a thing", () => {
    const upcoming = upcomingMaintenance([incident({ id: "a", startedAt: at(24) })], NOW);
    expect(upcoming).toEqual([]);
  });
});

describe("history", () => {
  it("holds what is neither live nor upcoming, newest first", () => {
    const all = [
      incident({ id: "old", state: "resolved", startedAt: at(-100), resolvedAt: at(-99) }),
      incident({ id: "recent", state: "resolved", startedAt: at(-10), resolvedAt: at(-9) }),
      incident({ id: "live" }),
      incident({ id: "soon", kind: "maintenance", impact: "maintenance", startedAt: at(24) }),
    ];
    expect(pastIncidents(all, NOW).map((entry) => entry.id)).toEqual(["recent", "old"]);
  });

  it("puts a lapsed maintenance window in history rather than losing it", () => {
    // It is neither live (its end has passed) nor upcoming (it has started).
    // A list that only knew those two would silently drop it.
    const lapsed = incident({
      id: "m",
      kind: "maintenance",
      impact: "maintenance",
      startedAt: at(-5),
      scheduledEnd: at(-3),
    });
    expect(pastIncidents([lapsed], NOW).map((entry) => entry.id)).toEqual(["m"]);
  });
});

describe("the sentence beside an empty list", () => {
  it("refuses to claim anything when nothing was being recorded", () => {
    const note = incidentsNote([], null);
    expect(note).toMatch(/not a claim/i);
    expect(note).not.toMatch(/no incidents have occurred/i);
  });

  it("says since when, once there is a date to say", () => {
    expect(incidentsNote([], "4 September 2026")).toContain("4 September 2026");
    expect(incidentsNote([], "4 September 2026")).toMatch(/not a claim about anything before/i);
  });

  it("says what the list is when it has something in it", () => {
    expect(incidentsNote([incident({ id: "a" })], "4 September 2026")).toMatch(/newest first/i);
  });
});

describe("the vocabularies and the opening state", () => {
  it("opens maintenance as scheduled and an incident as investigating", () => {
    // Starting either in the other's state would put a sentence on the public
    // page that is not true yet.
    expect(openingStateFor("maintenance")).toEqual("scheduled");
    expect(openingStateFor("incident")).toEqual("investigating");
  });

  it("recognises its own states and impacts, and nothing else", () => {
    expect(isIncidentState("monitoring")).toBe(true);
    expect(isIncidentState("fixed")).toBe(false);
    expect(isIncidentImpact("outage")).toBe(true);
    expect(isIncidentImpact("catastrophe")).toBe(false);
  });
});
