import { describe, it, expect } from "vitest";
import {
  CALENDAR_PACK,
  parseIcs,
  findConflicts,
  findFreeTime,
  type CalendarEvent,
} from "../skills/packs/calendar-pack";

/**
 * Real .ics text, including the folded lines and escaped characters that real
 * exports contain and hand-rolled parsers quietly mangle.
 */

const ics = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//EN", ...events, "END:VCALENDAR"].join("\r\n");

const event = (uid: string, summary: string, start: string, end?: string) =>
  [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SUMMARY:${summary}`,
    `DTSTART:${start}`,
    ...(end ? [`DTEND:${end}`] : []),
    "END:VEVENT",
  ].join("\r\n");

function parse(text: string): CalendarEvent[] {
  const r = parseIcs(text);
  if (!r.ok) throw new Error(`fixture failed: ${r.reason}`);
  return r.data;
}

describe("the pack states its own limits", () => {
  it("says plainly that it cannot sign in or send invitations", () => {
    expect(CALENDAR_PACK.coverageNote).toMatch(/cannot sign into Outlook/i);
    expect(CALENDAR_PACK.coverageNote).toMatch(/never sends invitations/i);
  });
});

describe("reading a calendar file", () => {
  it("reads events with their times", () => {
    const events = parse(ics(event("a", "Standup", "20260723T090000Z", "20260723T091500Z")));
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Standup");
    expect(events[0].start.toISOString()).toBe("2026-07-23T09:00:00.000Z");
    expect(events[0].end.toISOString()).toBe("2026-07-23T09:15:00.000Z");
    expect(events[0].floating).toBe(false);
  });

  /**
   * The detail most hand-written parsers get wrong. A folded line continues
   * with a leading space; reading line-by-line truncates the summary and the
   * result still looks like a perfectly valid event.
   */
  it("unfolds wrapped lines instead of truncating them", () => {
    const folded = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:a",
      "SUMMARY:Quarterly planning session with the whole engineering",
      "  department and the design team",
      "DTSTART:20260723T090000Z",
      "DTEND:20260723T100000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parse(folded);
    expect(events[0].summary).toBe(
      "Quarterly planning session with the whole engineering department and the design team",
    );
  });

  it("unescapes commas, semicolons and newlines", () => {
    const events = parse(
      ics(event("a", "Review\\, then lunch\\; bring notes\\nRoom 3", "20260723T090000Z")),
    );
    expect(events[0].summary).toBe("Review, then lunch; bring notes\nRoom 3");
  });

  it("treats an event with no end as a point in time, per the spec", () => {
    const events = parse(ics(event("a", "Reminder", "20260723T090000Z")));
    expect(events[0].end.getTime()).toBe(events[0].start.getTime());
  });

  it("reads all-day events", () => {
    const events = parse(ics(event("a", "Holiday", "20260723")));
    expect(events[0].allDay).toBe(true);
    expect(events[0].floating).toBe(false);
  });

  it("flags a time with no zone rather than assuming UTC", () => {
    const events = parse(ics(event("a", "Local meeting", "20260723T090000")));
    expect(events[0].floating).toBe(true);
  });

  it("refuses a file that isn't a calendar", () => {
    const r = parseIcs("just some text");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/BEGIN:VCALENDAR/);
  });

  it("refuses a truncated file rather than returning what it got", () => {
    const truncated = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:a", "DTSTART:20260723T090000Z"].join(
      "\r\n",
    );
    const r = parseIcs(truncated);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/truncated/i);
  });

  it("refuses an event that ends before it starts", () => {
    const r = parseIcs(ics(event("a", "Backwards", "20260723T100000Z", "20260723T090000Z")));
    expect(r.ok).toBe(false);
  });

  it("refuses an event with no start", () => {
    const r = parseIcs(
      ics(["BEGIN:VEVENT", "UID:a", "SUMMARY:No time", "END:VEVENT"].join("\r\n")),
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/no start time/i);
  });

  it("counts unzoned events in its evidence line", () => {
    const r = parseIcs(
      ics(event("a", "Zoned", "20260723T090000Z"), event("b", "Floating", "20260723T110000")),
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/1 without a time zone/);
  });
});

describe("finding clashes", () => {
  it("finds a genuine overlap and measures it", () => {
    const events = parse(
      ics(
        event("a", "Design review", "20260723T090000Z", "20260723T100000Z"),
        event("b", "1:1", "20260723T093000Z", "20260723T103000Z"),
      ),
    );
    const r = findConflicts(events);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(1);
    expect(r.data[0].overlapMinutes).toBe(30);
  });

  /** Back-to-back meetings are not a clash — an off-by-one here is very noisy. */
  it("does not report touching events as overlapping", () => {
    const events = parse(
      ics(
        event("a", "First", "20260723T090000Z", "20260723T100000Z"),
        event("b", "Second", "20260723T100000Z", "20260723T110000Z"),
      ),
    );
    const r = findConflicts(events);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(0);
  });

  it("finds an event fully contained in another", () => {
    const events = parse(
      ics(
        event("a", "All morning", "20260723T090000Z", "20260723T120000Z"),
        event("b", "Quick call", "20260723T100000Z", "20260723T101500Z"),
      ),
    );
    const r = findConflicts(events);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(1);
    expect(r.data[0].overlapMinutes).toBe(15);
  });

  /**
   * The refusal that matters. One unzoned time can move a comparison by hours;
   * a confident clash report built on it is worse than no report.
   */
  it("refuses to compare unzoned times against zoned ones", () => {
    const events = parse(
      ics(
        event("a", "Zoned", "20260723T090000Z", "20260723T100000Z"),
        event("b", "Floating", "20260723T093000", "20260723T103000"),
      ),
    );
    const r = findConflicts(events);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/no time zone/i);
    expect(r.reason).toMatch(/hours out/i);
  });

  it("reports honestly when there are no clashes", () => {
    const events = parse(
      ics(
        event("a", "Morning", "20260723T090000Z", "20260723T100000Z"),
        event("b", "Afternoon", "20260723T140000Z", "20260723T150000Z"),
      ),
    );
    const r = findConflicts(events);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/No overlaps across 2 events/);
  });
});

describe("finding free time", () => {
  const day = (h: number) => new Date(Date.UTC(2026, 6, 23, h, 0, 0));

  it("finds the gaps between meetings", () => {
    const events = parse(
      ics(
        event("a", "Standup", "20260723T090000Z", "20260723T093000Z"),
        event("b", "Review", "20260723T140000Z", "20260723T150000Z"),
      ),
    );
    const r = findFreeTime(events, day(9), day(17), 60);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(2);
    expect(r.data[0].minutes).toBe(270); // 09:30 → 14:00
    expect(r.data[1].minutes).toBe(120); // 15:00 → 17:00
  });

  it("merges overlapping meetings rather than double-counting them", () => {
    const events = parse(
      ics(
        event("a", "One", "20260723T090000Z", "20260723T110000Z"),
        event("b", "Two", "20260723T100000Z", "20260723T120000Z"),
      ),
    );
    const r = findFreeTime(events, day(9), day(17), 60);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(1);
    expect(r.data[0].minutes).toBe(300); // 12:00 → 17:00
  });

  it("ignores gaps shorter than asked for", () => {
    const events = parse(
      ics(
        event("a", "One", "20260723T090000Z", "20260723T100000Z"),
        event("b", "Two", "20260723T101500Z", "20260723T170000Z"),
      ),
    );
    const r = findFreeTime(events, day(9), day(17), 60);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(0);
    expect(r.evidence).toMatch(/No free block of 60 minutes/);
  });

  /** An all-day marker is not a 24-hour booking. */
  it("does not treat an all-day event as blocking the whole day", () => {
    const events = parse(ics(event("a", "Company holiday", "20260723")));
    const r = findFreeTime(events, day(9), day(17), 60);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toHaveLength(1);
    expect(r.data[0].minutes).toBe(480);
  });

  it("refuses a backwards window", () => {
    expect(findFreeTime([], day(17), day(9), 60).ok).toBe(false);
  });

  it("refuses when an event has no time zone", () => {
    const events = parse(ics(event("a", "Floating", "20260723T090000")));
    expect(findFreeTime(events, day(9), day(17), 60).ok).toBe(false);
  });
});
