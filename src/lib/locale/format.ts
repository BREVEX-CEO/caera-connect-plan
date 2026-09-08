/**
 * ONE PLACE THAT FORMATS A DATE, A TIME, A NUMBER OR AN AMOUNT.
 *
 * The product had three different answers to "which locale?" at once:
 * `toLocaleString()` with no argument in fifty-one places (whatever the browser
 * happens to be set to), `toLocaleDateString(undefined, …)` in twelve more (the
 * same thing, written differently), and a hard-coded `"en-GB"` in seven. So the
 * same account could see a British date on one screen and an American one on the
 * next, and neither followed the setting the person chose.
 *
 * That is not cosmetic. `9/3/2026` is the third of September to a British or
 * Indian reader and the ninth of March to an American one, and nothing on the
 * screen says which. A number grouped `1,234,567` is unreadable to somebody who
 * groups it `12,34,567`. Both are wrong answers, delivered confidently.
 *
 * EVERYTHING HERE TAKES THE LOCALE EXPLICITLY. There is no ambient default and
 * no module-level state: a formatter that reads a global is a formatter that
 * produces different output depending on import order, which is the hardest
 * class of bug to see in a screenshot.
 *
 * `Intl` FORMATTERS ARE CACHED because constructing one is expensive — measured
 * in the hundreds of microseconds — and a table of two hundred rows constructs
 * two hundred of them otherwise.
 */

import { DEFAULT_LOCALE, describeLocale, type SupportedLocale } from "./supported-locales";

const dateTimeCache = new Map<string, Intl.DateTimeFormat>();
const numberCache = new Map<string, Intl.NumberFormat>();
const relativeCache = new Map<string, Intl.RelativeTimeFormat>();

function dateTimeFormatter(
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateTimeCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateTimeCache.set(key, formatter);
  }
  return formatter;
}

function numberFormatter(
  locale: SupportedLocale,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = numberCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberCache.set(key, formatter);
  }
  return formatter;
}

/**
 * A date, in the reader's order.
 *
 * `dateStyle: "medium"` rather than a numeric format, deliberately: it renders
 * the month as a word in every locale here, which removes the day/month
 * ambiguity entirely rather than resolving it correctly and hoping the reader
 * knows that.
 */
export function formatDate(
  value: Date | string | number | null | undefined,
  locale: SupportedLocale = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  const date = toDate(value);
  if (!date) return "";
  return dateTimeFormatter(locale, options).format(date);
}

export function formatDateTime(
  value: Date | string | number | null | undefined,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const date = toDate(value);
  if (!date) return "";
  return dateTimeFormatter(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatTime(
  value: Date | string | number | null | undefined,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const date = toDate(value);
  if (!date) return "";
  return dateTimeFormatter(locale, { timeStyle: "short" }).format(date);
}

export function formatNumber(
  value: number | null | undefined,
  locale: SupportedLocale = DEFAULT_LOCALE,
  options: Intl.NumberFormatOptions = {},
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return numberFormatter(locale, options).format(value);
}

/**
 * An amount of money, in the currency the caller names.
 *
 * THE CURRENCY IS NEVER INFERRED FROM THE LOCALE. A German reader looking at a
 * price in dollars must see dollars; rendering it as euros because their locale
 * is de-DE would be a false statement about what they will be charged, and it is
 * the kind of false statement people only discover on a bank statement.
 * `describeLocale().currency` exists for choosing what to OFFER, never for
 * relabelling an amount that already has one.
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "";
  if (!/^[A-Z]{3}$/.test(currency)) return formatNumber(amount, locale);
  return numberFormatter(locale, { style: "currency", currency }).format(amount);
}

/**
 * "3 days ago", in the reader's language.
 *
 * THE UNIT IS NEVER ONE THAT ROUNDS TO ZERO. A unit is only used once the gap
 * is at least one of it, so "in 0 hours" — which says nothing and looks broken —
 * cannot be produced. Fifty-nine minutes reads as "in 59 minutes", which is
 * accurate; the alternative of promoting it to "in 1 hour" trades correctness
 * for friendliness on exactly the values where somebody is watching the clock.
 */
export function formatRelativeTime(
  value: Date | string | number | null | undefined,
  locale: SupportedLocale = DEFAULT_LOCALE,
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (!date) return "";
  let formatter = relativeCache.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    relativeCache.set(locale, formatter);
  }
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(seconds, "second");
}

/** The currency a person in this locale would expect to be offered. */
export function preferredCurrency(locale: SupportedLocale = DEFAULT_LOCALE): string {
  return describeLocale(locale).currency;
}

/** A date from whatever the caller had, or null when it is not one. */
function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  // An invalid date renders as "Invalid Date" in every browser, which is a
  // developer's error message in front of a customer.
  return Number.isNaN(date.getTime()) ? null : date;
}
