/**
 * Calendar arithmetic for the date picker.
 *
 * Pure and UTC-based, so a month grid and an ISO round-trip can be tested
 * without a DOM and without the runner's timezone changing the answer.
 */
export interface CalendarCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

export function isoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return isoDate(date) === value ? date : null;
}

export function calendarCells(month: Date): CalendarCell[] {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return {
      iso: isoDate(date),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthIndex,
    };
  });
}
