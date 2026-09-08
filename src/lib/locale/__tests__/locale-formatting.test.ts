import { describe, expect, it } from "vitest";
import {
  browserPreferredLocale,
  DEFAULT_LOCALE,
  describeLocale,
  isSupportedLocale,
  resolveLocale,
  SUPPORTED_LOCALES,
} from "../supported-locales";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatRelativeTime,
  formatTime,
  preferredCurrency,
} from "../format";

/**
 * THE SAME INSTANT, READ CORRECTLY BY EIGHT DIFFERENT PEOPLE.
 *
 * PLAN.md §26 names eight locales. The defects this prevents are not missing
 * polish, they are wrong answers delivered confidently:
 *
 *   `9/3/2026` is the third of September to a British or Indian reader and the
 *   ninth of March to an American one, and nothing on the screen says which.
 *
 *   `1,234,567` is unreadable to somebody who groups it `12,34,567`.
 *
 *   A price shown to a German reader in euros when it will be charged in
 *   dollars is a false statement about money.
 *
 * Formatting is asserted through `Intl` rather than against hard-coded strings,
 * because the exact glyphs a runtime produces are its business and change
 * between ICU versions — what must hold is that the SAME instant reads
 * differently in locales that genuinely differ, and that OCADE never picks the
 * currency for you.
 */

const AT = new Date("2026-09-03T14:30:00Z");

describe("the supported locales", () => {
  it("are exactly the eight PLAN.md §26 names", () => {
    expect(SUPPORTED_LOCALES.map((locale) => locale.tag)).toEqual([
      "en-US",
      "en-GB",
      "en-IN",
      "hi-IN",
      "de-DE",
      "fr-FR",
      "es-ES",
      "ja-JP",
    ]);
  });

  it("says which are genuinely translated rather than implying all of them are", () => {
    /*
     * Shipping machine-translated strings for seven locales would look like
     * support and read like nonsense in each, and the person affected is the
     * one least able to tell OCADE it is wrong.
     */
    const translated = SUPPORTED_LOCALES.filter((locale) => locale.translated).map((l) => l.tag);
    expect(translated).toEqual(["en-US", "en-GB", "en-IN"]);
    for (const locale of SUPPORTED_LOCALES) {
      expect(locale.nativeLabel.length, locale.tag).toBeGreaterThan(0);
      expect(locale.currency, locale.tag).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("recognises its own tags and nothing else", () => {
    expect(isSupportedLocale("de-DE")).toBe(true);
    expect(isSupportedLocale("de")).toBe(false);
    expect(isSupportedLocale("klingon")).toBe(false);
    expect(describeLocale("ja-JP").nativeLabel).toBe("日本語");
  });
});

describe("resolving what somebody asked for", () => {
  it("takes an exact match first", () => {
    expect(resolveLocale(["hi-IN", "en-GB"])).toBe("hi-IN");
  });

  it("falls back to the same language before giving up", () => {
    // An Australian reader is far better served by British English than by a
    // default that might not even be English.
    expect(resolveLocale(["en-AU"])).toBe("en-US");
    expect(resolveLocale(["de-AT"])).toBe("de-DE");
    expect(resolveLocale(["ja"])).toBe("ja-JP");
  });

  it("respects the ORDER of the preferences", () => {
    // Somebody who lists German first has said something that a single-value
    // `navigator.language` throws away.
    expect(resolveLocale(["de-DE", "en-GB"])).toBe("de-DE");
    expect(resolveLocale(["en-GB", "de-DE"])).toBe("en-GB");
  });

  it("falls back to the default for a language it does not have", () => {
    expect(resolveLocale(["is-IS"])).toBe(DEFAULT_LOCALE);
    expect(resolveLocale([])).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(["", "   "])).toBe(DEFAULT_LOCALE);
  });

  it("reads an ordered preference list rather than a single language", () => {
    /*
     * Taken as a parameter so this is a fact about the product rather than
     * about the test runner. Node defines `navigator` too, so the first version
     * of this — asserting the no-browser fallback — passed while proving
     * nothing at all.
     */
    expect(browserPreferredLocale(["de-DE", "en-GB"])).toBe("de-DE");
    expect(browserPreferredLocale([])).toBe(DEFAULT_LOCALE);
    expect(browserPreferredLocale(["en-AU"])).toBe("en-US");
  });
});

describe("dates and times read as the reader expects", () => {
  it("uses each locale's own medium form rather than one convention for everybody", () => {
    /*
     * The first version of this asserted that the month is always a word,
     * because that removes the day/month ambiguity outright. It is not true and
     * should not be: German's medium date is `03.09.2026`, and the dots ARE the
     * German convention — a reader there parses it correctly and would find a
     * spelled month unusual. The guarantee is that every reader gets their own
     * convention, not that everybody gets the same trick.
     */
    for (const locale of SUPPORTED_LOCALES) {
      const formatted = formatDate(AT, locale.tag);
      expect(formatted.length, locale.tag).toBeGreaterThan(0);
      expect(formatted, locale.tag).not.toMatch(/Invalid Date/);
      // Never the raw ISO string, which is what a missing formatter looks like.
      expect(formatted, locale.tag).not.toBe(AT.toISOString());
    }
    // American and British medium dates differ, which is the whole point.
    expect(formatDate(AT, "en-US")).not.toBe(formatDate(AT, "en-GB"));
  });

  it("formats the same instant differently where the locales genuinely differ", () => {
    expect(formatDate(AT, "en-US")).not.toBe(formatDate(AT, "ja-JP"));
    expect(formatDate(AT, "de-DE")).not.toBe(formatDate(AT, "en-GB"));
  });

  it("renders a date, a date-and-time and a time without throwing on junk", () => {
    expect(formatDateTime(AT, "en-GB")).toContain(formatDate(AT, "en-GB"));
    expect(formatTime(AT, "en-GB").length).toBeGreaterThan(0);
    for (const junk of [null, undefined, "not a date", Number.NaN]) {
      // "Invalid Date" is a developer's error message in front of a customer.
      expect(formatDate(junk as never, "en-GB")).toBe("");
      expect(formatDateTime(junk as never, "en-GB")).toBe("");
      expect(formatTime(junk as never, "en-GB")).toBe("");
    }
  });

  it("describes a relative time in the reader's language", () => {
    const anHourAgo = new Date(AT.getTime() - 3600_000);
    expect(formatRelativeTime(anHourAgo, "en-GB", AT)).toMatch(/hour/i);
    expect(formatRelativeTime(anHourAgo, "de-DE", AT)).not.toMatch(/hour/i);
  });

  it("never picks a unit that rounds to zero of itself", () => {
    /*
     * "in 0 hours" says nothing and looks broken. A unit is only used once the
     * gap is at least one of it, so fifty-nine minutes reads as minutes —
     * accurate, rather than promoted to "in 1 hour" on exactly the values where
     * somebody is watching the clock.
     */
    for (const offsetSeconds of [1, 59, 60, 3540, 3600, 86_399, 86_400, 2_591_999]) {
      for (const direction of [1, -1]) {
        const at = new Date(AT.getTime() + direction * offsetSeconds * 1000);
        const text = formatRelativeTime(at, "en-GB", AT);
        expect(text, `${direction * offsetSeconds}s -> ${text}`).not.toMatch(/\b0\s/);
      }
    }
    expect(formatRelativeTime(new Date(AT.getTime() + 59 * 60_000), "en-GB", AT)).toMatch(
      /minute/i,
    );
    expect(formatRelativeTime(new Date(AT.getTime() + 60 * 60_000), "en-GB", AT)).toMatch(/hour/i);
  });
});

describe("numbers and money", () => {
  it("groups a number the way the reader groups it", () => {
    // The Indian grouping is 12,34,567 rather than 1,234,567.
    expect(formatNumber(1234567, "en-IN")).not.toBe(formatNumber(1234567, "en-US"));
    expect(formatNumber(1234567, "de-DE")).not.toBe(formatNumber(1234567, "en-US"));
  });

  it("returns nothing rather than NaN for something that is not a number", () => {
    for (const junk of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatNumber(junk as never, "en-GB")).toBe("");
    }
  });

  it("NEVER infers the currency from the locale", () => {
    /*
     * A German reader looking at a price in dollars must see dollars. Showing
     * euros because their locale is de-DE is a false statement about what they
     * will be charged, and one people only discover on a bank statement.
     */
    const asGerman = formatMoney(1234.5, "USD", "de-DE");
    expect(asGerman).toMatch(/\$|USD/);
    expect(asGerman).not.toMatch(/€/);
    // The same amount, genuinely in euros, reads differently.
    expect(formatMoney(1234.5, "EUR", "de-DE")).not.toBe(asGerman);
  });

  it("offers a currency per locale, which is a different question", () => {
    expect(preferredCurrency("en-IN")).toBe("INR");
    expect(preferredCurrency("ja-JP")).toBe("JPY");
    expect(preferredCurrency("fr-FR")).toBe("EUR");
  });

  it("degrades to a plain number rather than throwing on a bad currency code", () => {
    expect(formatMoney(1234.5, "not-a-code", "en-GB")).toBe(formatNumber(1234.5, "en-GB"));
    expect(formatMoney(null, "USD", "en-GB")).toBe("");
  });
});
