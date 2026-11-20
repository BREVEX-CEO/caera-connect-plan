/**
 * WHEN A SCHEDULED JARVIS RUN HAPPENS, IN THE PERSON'S OWN TIME ZONE.
 *
 * A schedule keeps its next run as an instant (`next_at`) and its zone. A repeat keeps the
 * same wall-clock time in that zone ("every weekday at 09:00 in Asia/Kolkata"), so a daylight-
 * saving change moves the instant, not the time the person chose. Pure: no clock, no storage.
 */

export type ScheduleRepeat = "none" | "daily" | "weekdays" | "weekly";

export const SCHEDULE_REPEATS: readonly ScheduleRepeat[] = ["none", "daily", "weekdays", "weekly"];

/** True for a zone this runtime knows (IANA name), so a typo is refused, never guessed. */
export function isTimeZone(zone: string): boolean {
  if (!zone || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

interface Wall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 Sunday … 6 Saturday
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall-clock reading of an instant in a zone. */
export function wallTime(instant: Date, zone: string): Wall {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday!),
  };
}

/**
 * The instant at which a zone's clock reads this wall time. A time the clock skips (spring
 * forward) resolves to the same reading after the change; a time it repeats (fall back)
 * resolves to the first.
 */
export function zonedInstant(
  wall: Pick<Wall, "year" | "month" | "day" | "hour" | "minute">,
  zone: string,
): Date {
  const target = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  let guess = target;
  for (let i = 0; i < 3; i += 1) {
    const seen = wallTime(new Date(guess), zone);
    const reading = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    if (reading === target) break;
    guess += target - reading;
  }
  // Fall back: an hour earlier may read the same, and the first one is wanted.
  const earlier = guess - 3_600_000;
  const before = wallTime(new Date(earlier), zone);
  if (Date.UTC(before.year, before.month - 1, before.day, before.hour, before.minute) === target) {
    return new Date(earlier);
  }
  return new Date(guess);
}

/**
 * The run after `occurrence` for a repeat, or null for a one-time schedule. Strictly after
 * `notBefore` as well, so a schedule that was paused or missed runs next at its next future
 * slot instead of catching up on every missed one.
 */
export function nextOccurrence(
  occurrence: Date,
  repeat: ScheduleRepeat,
  zone: string,
  notBefore: Date = occurrence,
): Date | null {
  if (repeat === "none") return null;
  const start = wallTime(occurrence, zone);
  let day = new Date(Date.UTC(start.year, start.month - 1, start.day));
  for (let step = 0; step < 800; step += 1) {
    day = new Date(day.getTime() + (repeat === "weekly" ? 7 : 1) * 86_400_000);
    const weekday = day.getUTCDay();
    if (repeat === "weekdays" && (weekday === 0 || weekday === 6)) continue;
    const candidate = zonedInstant(
      {
        year: day.getUTCFullYear(),
        month: day.getUTCMonth() + 1,
        day: day.getUTCDate(),
        hour: start.hour,
        minute: start.minute,
      },
      zone,
    );
    if (candidate.getTime() > notBefore.getTime()) return candidate;
  }
  return null;
}
