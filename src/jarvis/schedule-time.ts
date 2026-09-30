/**
 * Wall-clock time in a person's own time zone, for reminders and scheduled
 * work: "every day at 9" stays at 9 when the clocks change, and a run missed
 * while OCADE was unreachable is skipped, never replayed later in a burst.
 */
export type Repeat = "none" | "daily" | "weekdays" | "weekly";

interface Wall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
}

/** A time zone Intl knows, else UTC. */
export function safeZone(timeZone: string | undefined | null): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timeZone || "UTC" });
    return timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function wall(at: Date, timeZone: string): Wall {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday"),
  };
}

const asUtc = (w: Omit<Wall, "weekday">) =>
  Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);

/** The instant a given wall-clock time names in `timeZone` (days may overflow: the 32nd is the 1st). */
function instant(w: Omit<Wall, "weekday">, timeZone: string): Date {
  const target = asUtc(w);
  let guess = target;
  // Two corrections settle the zone offset, including on the day it changes.
  for (let i = 0; i < 2; i += 1) guess += target - asUtc(wall(new Date(guess), timeZone));
  return new Date(guess);
}

/** The next run after `previous`, strictly later than `now`; null when it does not repeat. */
export function nextOccurrence(
  previous: Date,
  repeat: Repeat,
  zone: string,
  now: Date,
): Date | null {
  if (repeat === "none") return null;
  const timeZone = safeZone(zone);
  const start = wall(previous, timeZone);
  for (let days = repeat === "weekly" ? 7 : 1; days < 3700; days += repeat === "weekly" ? 7 : 1) {
    const next = instant({ ...start, day: start.day + days }, timeZone);
    if (next <= now) continue;
    if (repeat === "weekdays" && ["Sat", "Sun"].includes(wall(next, timeZone).weekday)) continue;
    return next;
  }
  return null;
}

/** `2026-09-30T22:40:00+05:30`: what the model is told the time is, in the person's own zone. */
export function localIso(at: Date, zone: string): string {
  const timeZone = safeZone(zone);
  const w = wall(at, timeZone);
  const offset = Math.round((asUtc(w) - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
  const sign = offset < 0 ? "-" : "+";
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  return (
    `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}` +
    `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  );
}
