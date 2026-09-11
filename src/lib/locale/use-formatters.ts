import { useMemo } from "react";
import { useLocale } from "./use-locale";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatRelativeTime,
  formatTime,
} from "./format";

/**
 * THE FORMATTERS, BOUND TO THE LOCALE THIS PERSON CHOSE.
 *
 * `format.ts` takes the locale explicitly and has no ambient default, which is
 * the right shape for a module — and it is why nothing used it. A screen that
 * wants a date has to call `useLocale()`, destructure it, and remember to pass
 * it to every call; seventy-one call sites did the easy thing instead and asked
 * the browser directly with `toLocaleString()`.
 *
 * So the easy thing is now the correct thing. One hook, one destructure, and
 * the locale is already applied.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS. `9/3/2026` is the third of September to
 * a British or Indian reader and the ninth of March to an American one, and
 * nothing on screen says which. `1,234,567` is unreadable to somebody who
 * groups digits `12,34,567`. Both are wrong answers delivered confidently, and
 * both were being produced on screens where the person had explicitly chosen a
 * locale that says otherwise.
 */
export interface Formatters {
  /**
   * A date. The default puts the month in words, so day/month order cannot be
   * misread; a caller that needs a narrower shape — a weekday, a day and month
   * for a column heading — passes its own options and still gets this reader's
   * language rather than the browser's.
   */
  date(
    value: Date | string | number | null | undefined,
    options?: Intl.DateTimeFormatOptions,
  ): string;
  /** A date and a time together. */
  dateTime(value: Date | string | number | null | undefined): string;
  /** A time on its own. */
  time(value: Date | string | number | null | undefined): string;
  /** A number, grouped the way this reader groups numbers. */
  number(value: number | null | undefined, options?: Intl.NumberFormatOptions): string;
  /** An amount in the currency the caller names. The currency is never inferred. */
  money(amount: number | null | undefined, currency: string): string;
  /** "3 days ago", in the reader's language. */
  relative(value: Date | string | number | null | undefined, now?: Date): string;
}

export function useFormatters(): Formatters {
  const { locale } = useLocale();
  return useMemo(
    () => ({
      date: (value, options) => formatDate(value, locale, options),
      dateTime: (value) => formatDateTime(value, locale),
      time: (value) => formatTime(value, locale),
      number: (value, options) => formatNumber(value, locale, options),
      money: (amount, currency) => formatMoney(amount, currency, locale),
      relative: (value, now) => formatRelativeTime(value, locale, now),
    }),
    [locale],
  );
}
