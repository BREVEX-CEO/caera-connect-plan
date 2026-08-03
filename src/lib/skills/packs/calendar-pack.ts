/**
 * Calendar skill pack — a REAL, executed adapter for the chat/projects
 * category.
 *
 * Scope, stated plainly: this pack reads **iCalendar (.ics) files**, the format
 * every calendar exports. It does not sign into Outlook, Google Calendar, Slack
 * or Teams, and it never sends an invitation. `coverageNote` says so.
 *
 * Two details decide whether a calendar parser is correct or merely plausible:
 *
 *  1. **Line unfolding.** RFC 5545 wraps long lines and continues them with a
 *     leading space. A parser that reads line-by-line silently truncates every
 *     long summary — and the result still looks like a valid event.
 *  2. **Time zones are not optional.** A local time with no zone and no UTC
 *     marker is "floating": it means 09:00 wherever you happen to be. Comparing
 *     one against a zoned time to find a clash produces a confident answer that
 *     is wrong by hours, so it is refused instead.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

const CAPABILITIES: SkillCapability[] = [
  {
    id: "calendar.parse",
    label: "Read a calendar file",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "calendar.conflicts",
    label: "Find overlapping events",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
  {
    id: "calendar.free_time",
    label: "Find free time in a day",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
];

export const CALENDAR_PACK: SkillPack = {
  appId: "ocade.calendar",
  displayName: "Calendars and schedules",
  category: "chat_projects",
  // Pinned to RFC 5545, which is what this pack implements.
  testedVersions: ["2.0"],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
  coverageNote:
    "Reads exported .ics calendar files. OCADE cannot sign into Outlook, Google Calendar, Slack or Teams, and never sends invitations or replies.",
};

export type CalendarOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface CalendarEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  /** True when the source time carried no zone — comparisons are unsafe. */
  floating: boolean;
  allDay: boolean;
}

/* --------------------------------------------------------------- parsing -- */

/**
 * Undo RFC 5545 line folding: a line beginning with a space or tab continues
 * the previous one.
 */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** iCalendar escapes \, \; \n and \\ inside text values. */
function unescapeText(v: string): string {
  return v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseProp(line: string): Prop | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf("=");
    if (eq !== -1) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

interface ParsedTime {
  date: Date;
  floating: boolean;
  allDay: boolean;
}

/**
 * Read a DTSTART/DTEND value.
 *
 * A trailing `Z` means UTC. A `TZID` parameter names a zone. Anything else is
 * floating local time, and is flagged rather than assumed to be UTC — assuming
 * is how an agent reports a clash that isn't there, or misses one that is.
 */
function parseTime(prop: Prop): CalendarOutcome<ParsedTime> {
  const v = prop.value.trim();

  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return {
      ok: true,
      data: {
        date: new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))),
        floating: false,
        allDay: true,
      },
      evidence: "all-day",
    };
  }

  const stamp = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!stamp) {
    return { ok: false, reason: `OCADE can't read “${prop.value}” as a date and time.` };
  }
  const [, y, mo, d, h, mi, s, z] = stamp;
  const date = new Date(
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)),
  );
  if (Number.isNaN(date.getTime())) {
    return { ok: false, reason: `“${prop.value}” isn't a real date.` };
  }

  // TZID names a zone but resolving it needs a tz database this pack does not
  // carry, so a TZID time is treated as floating: known to be unsafe to
  // compare, rather than silently mis-compared.
  const floating = z !== "Z";
  return {
    ok: true,
    data: { date, floating, allDay: false },
    evidence: floating ? "local time" : "UTC",
  };
}

/** Parse an iCalendar document into events. */
export function parseIcs(text: string): CalendarOutcome<CalendarEvent[]> {
  if (!text.trim()) return { ok: false, reason: "That file is empty." };

  const lines = unfold(text);
  if (!lines.some((l) => l.trim().toUpperCase() === "BEGIN:VCALENDAR")) {
    return { ok: false, reason: "That isn't an iCalendar file — it has no BEGIN:VCALENDAR." };
  }

  const events: CalendarEvent[] = [];
  let current: (Partial<CalendarEvent> & { hasStart?: boolean }) | null = null;
  let index = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === "BEGIN:VEVENT") {
      index++;
      current = {};
      continue;
    }
    if (trimmed.toUpperCase() === "END:VEVENT") {
      if (!current) continue;
      if (!current.start) {
        return { ok: false, reason: `Event ${index} has no start time, so it can't be placed.` };
      }
      events.push({
        uid: current.uid ?? `event-${index}`,
        summary: current.summary ?? "(no title)",
        start: current.start,
        // RFC 5545: an event with no DTEND is a point in time.
        end: current.end ?? current.start,
        floating: current.floating ?? false,
        allDay: current.allDay ?? false,
      });
      current = null;
      continue;
    }
    if (!current) continue;

    const prop = parseProp(line);
    if (!prop) continue;

    if (prop.name === "UID") current.uid = prop.value.trim();
    else if (prop.name === "SUMMARY") current.summary = unescapeText(prop.value);
    else if (prop.name === "DTSTART") {
      const t = parseTime(prop);
      if (!t.ok) return t;
      current.start = t.data.date;
      current.floating = t.data.floating;
      current.allDay = t.data.allDay;
    } else if (prop.name === "DTEND") {
      const t = parseTime(prop);
      if (!t.ok) return t;
      current.end = t.data.date;
      if (t.data.floating) current.floating = true;
    }
  }

  if (current !== null) {
    return { ok: false, reason: "This file ends inside an event — it's truncated." };
  }
  if (events.length === 0) {
    return { ok: false, reason: "This calendar has no events." };
  }

  for (const e of events) {
    if (e.end.getTime() < e.start.getTime()) {
      return { ok: false, reason: `“${e.summary}” ends before it starts, so this file is wrong.` };
    }
  }

  const floating = events.filter((e) => e.floating).length;
  return {
    ok: true,
    data: events,
    evidence:
      floating > 0
        ? `${events.length} event${events.length === 1 ? "" : "s"}, ${floating} without a time zone.`
        : `${events.length} event${events.length === 1 ? "" : "s"}.`,
  };
}

/* ------------------------------------------------------------- conflicts -- */

export interface Conflict {
  a: CalendarEvent;
  b: CalendarEvent;
  overlapMinutes: number;
}

/**
 * Find events that overlap.
 *
 * Refuses outright when any event is floating: one unzoned time can shift a
 * comparison by hours, and a clash report that is confidently wrong is worse
 * than being told the file needs fixing first.
 */
export function findConflicts(events: CalendarEvent[]): CalendarOutcome<Conflict[]> {
  const floating = events.filter((e) => e.floating);
  if (floating.length > 0) {
    return {
      ok: false,
      reason: `${floating.length} event${floating.length === 1 ? " has" : "s have"} no time zone (e.g. “${floating[0].summary}”). OCADE won't compare those against zoned times — the answer would look right and be hours out.`,
    };
  }

  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const conflicts: Conflict[] = [];

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (b.start.getTime() >= a.end.getTime()) break; // sorted: no later event can overlap
      // Touching events (one ends exactly as the next begins) do not overlap.
      const overlap = Math.min(a.end.getTime(), b.end.getTime()) - b.start.getTime();
      if (overlap > 0) conflicts.push({ a, b, overlapMinutes: Math.round(overlap / 60000) });
    }
  }

  return {
    ok: true,
    data: conflicts,
    evidence:
      conflicts.length === 0
        ? `No overlaps across ${events.length} event${events.length === 1 ? "" : "s"}.`
        : `${conflicts.length} overlap${conflicts.length === 1 ? "" : "s"}, the longest ${Math.max(...conflicts.map((c) => c.overlapMinutes))} minutes.`,
  };
}

/* ------------------------------------------------------------- free time -- */

export interface FreeSlot {
  start: Date;
  end: Date;
  minutes: number;
}

/**
 * Gaps of at least `minMinutes` between `from` and `to`.
 *
 * All-day events are excluded from the busy set: they mark a day, not an hour,
 * and treating one as a 24-hour block would report a whole day as unavailable.
 */
export function findFreeTime(
  events: CalendarEvent[],
  from: Date,
  to: Date,
  minMinutes: number,
): CalendarOutcome<FreeSlot[]> {
  if (to.getTime() <= from.getTime()) {
    return { ok: false, reason: "That window ends before it starts." };
  }
  if (events.some((e) => e.floating)) {
    return {
      ok: false,
      reason: "Some events have no time zone, so OCADE can't place them in the day reliably.",
    };
  }

  const busy = events
    .filter((e) => !e.allDay)
    .map((e) => ({
      start: Math.max(e.start.getTime(), from.getTime()),
      end: Math.min(e.end.getTime(), to.getTime()),
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const b of busy) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) last.end = Math.max(last.end, b.end);
    else merged.push({ ...b });
  }

  const slots: FreeSlot[] = [];
  let cursor = from.getTime();
  for (const b of merged) {
    if (b.start - cursor >= minMinutes * 60000) {
      slots.push({
        start: new Date(cursor),
        end: new Date(b.start),
        minutes: Math.round((b.start - cursor) / 60000),
      });
    }
    cursor = Math.max(cursor, b.end);
  }
  if (to.getTime() - cursor >= minMinutes * 60000) {
    slots.push({
      start: new Date(cursor),
      end: to,
      minutes: Math.round((to.getTime() - cursor) / 60000),
    });
  }

  return {
    ok: true,
    data: slots,
    evidence:
      slots.length === 0
        ? `No free block of ${minMinutes} minutes or more.`
        : `${slots.length} free block${slots.length === 1 ? "" : "s"}, the longest ${Math.max(...slots.map((s) => s.minutes))} minutes.`,
  };
}
