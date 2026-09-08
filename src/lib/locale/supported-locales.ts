/**
 * THE LOCALES OCADE SUPPORTS, AND WHAT "SUPPORTED" HONESTLY MEANS HERE.
 *
 * PLAN.md §26 names eight: en-US, en-GB, en-IN, hi-IN, de-DE, fr-FR, es-ES and
 * ja-JP. This module is the one authority for that list.
 *
 * WHAT IS SUPPORTED TODAY, STATED WITHOUT INFLATION. OCADE formats dates, times,
 * numbers, currency amounts, lists and relative times in the person's locale, and
 * declares it on the document so a screen reader pronounces the page correctly.
 * Its INTERFACE TEXT is English. Shipping machine-translated strings for seven
 * locales would look like support and read like nonsense in each of them, and
 * the person affected is the one least able to tell OCADE it is wrong.
 *
 * So `translated` is a field, it is currently true for the English variants only,
 * and the settings surface says which is which. The gap ledger records the rest
 * as work rather than as a claim.
 *
 * WHY FORMATTING ALONE IS WORTH DOING. It is not a consolation prize. A German
 * reader shown `9/3/2026` reads September the third as March the ninth; an Indian
 * reader shown `1,234,567` reads a number written in a grouping their eye does
 * not parse. Those are wrong answers, not missing polish, and they are wrong
 * today because the product formats with a hard-coded `en-GB` in seven places and
 * the browser's own default in fifty-one others.
 */

export type SupportedLocale =
  "en-US" | "en-GB" | "en-IN" | "hi-IN" | "de-DE" | "fr-FR" | "es-ES" | "ja-JP";

export interface LocaleDescriptor {
  tag: SupportedLocale;
  /** The name in English, for an English interface. */
  label: string;
  /** The name in its own language, which is what a speaker looks for. */
  nativeLabel: string;
  /** True only where OCADE's interface text is genuinely in this language. */
  translated: boolean;
  /** The currency a person in this locale is most likely to expect. */
  currency: string;
}

export const SUPPORTED_LOCALES: readonly LocaleDescriptor[] = [
  {
    tag: "en-US",
    label: "English (United States)",
    nativeLabel: "English (US)",
    translated: true,
    currency: "USD",
  },
  {
    tag: "en-GB",
    label: "English (United Kingdom)",
    nativeLabel: "English (UK)",
    translated: true,
    currency: "GBP",
  },
  {
    tag: "en-IN",
    label: "English (India)",
    nativeLabel: "English (India)",
    translated: true,
    currency: "INR",
  },
  { tag: "hi-IN", label: "Hindi", nativeLabel: "हिन्दी", translated: false, currency: "INR" },
  { tag: "de-DE", label: "German", nativeLabel: "Deutsch", translated: false, currency: "EUR" },
  { tag: "fr-FR", label: "French", nativeLabel: "Français", translated: false, currency: "EUR" },
  { tag: "es-ES", label: "Spanish", nativeLabel: "Español", translated: false, currency: "EUR" },
  { tag: "ja-JP", label: "Japanese", nativeLabel: "日本語", translated: false, currency: "JPY" },
];

export const DEFAULT_LOCALE: SupportedLocale = "en-GB";

const BY_TAG = new Map(SUPPORTED_LOCALES.map((locale) => [locale.tag, locale]));

export function isSupportedLocale(tag: string): tag is SupportedLocale {
  return BY_TAG.has(tag as SupportedLocale);
}

export function describeLocale(tag: SupportedLocale): LocaleDescriptor {
  return BY_TAG.get(tag) ?? BY_TAG.get(DEFAULT_LOCALE)!;
}

/**
 * The best supported locale for a list of preferences.
 *
 * EXACT MATCH, THEN LANGUAGE, THEN THE DEFAULT. `en-AU` is not in the list, and
 * an Australian reader is far better served by `en-GB` than by being dropped to
 * a default that might not even be English — so the language subtag is tried
 * before giving up.
 *
 * REGION IS NOT DISCARDED SILENTLY. `en-IN` and `en-GB` differ in date order and
 * number grouping, so matching `en` to whichever English happens to be first
 * would be a wrong answer wearing the right language.
 */
export function resolveLocale(preferences: readonly string[]): SupportedLocale {
  for (const preference of preferences) {
    const tag = preference.trim();
    if (!tag) continue;
    if (isSupportedLocale(tag)) return tag;
  }
  for (const preference of preferences) {
    const language = preference.trim().split("-")[0]?.toLowerCase();
    if (!language) continue;
    const match = SUPPORTED_LOCALES.find(
      (locale) => locale.tag.split("-")[0].toLowerCase() === language,
    );
    if (match) return match.tag;
  }
  return DEFAULT_LOCALE;
}

/**
 * What the browser says it wants.
 *
 * `navigator.languages` rather than `navigator.language`: a person who lists
 * German first and English second has said something the single value throws
 * away, and it is exactly the case where falling back matters.
 *
 * The preferences are a PARAMETER so this can be tested without a browser.
 * Node defines `navigator` too, so a test that relied on its absence would be
 * asserting a fact about the test runner rather than about the product — which
 * is how this function's first test passed while proving nothing.
 */
export function browserPreferredLocale(
  preferences: readonly string[] = readNavigatorLanguages(),
): SupportedLocale {
  return resolveLocale(preferences);
}

function readNavigatorLanguages(): string[] {
  if (typeof navigator === "undefined") return [];
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return [...navigator.languages];
  }
  return navigator.language ? [navigator.language] : [];
}
