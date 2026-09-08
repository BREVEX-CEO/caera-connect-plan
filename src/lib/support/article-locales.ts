/**
 * WHICH LANGUAGE A HELP ARTICLE IS READ IN — PLAN.md §L's "locale support".
 *
 * WHAT THIS IS NOT: a translation pipeline, and not a place to put
 * machine-translated text. §26 already settled that question for the interface,
 * and the reasoning applies harder here: an article is what somebody reads when
 * they are already stuck, and a machine translation of "OCADE never grants paid
 * access from a redirect" that comes out slightly wrong is worse than English
 * they can paste into a translator themselves. The person affected is the one
 * least able to tell OCADE it is wrong.
 *
 * WHAT IT IS: the mechanism, complete, plus a truthful answer for every locale
 * that has no translation. An article carries its original text and, where a
 * translation genuinely exists, a variant per locale. Reading resolves to the
 * best available and SAYS which it gave you.
 *
 * THE SLUG NEVER CHANGES. §L asks for stable slugs, and a per-language URL
 * would mean a link shared between two colleagues stops working when one of
 * them changes their language. The locale selects the text; the address is the
 * article.
 *
 * FALLING BACK IS NOT FAILING. A German reader with no German article gets the
 * English one and a sentence saying so — never an empty page, and never a page
 * that pretends the English was written for them.
 */

import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/locale/supported-locales";
import type { SupportArticle } from "./articles";

/** The parts of an article that are language, rather than structure. */
export interface ArticleTranslation {
  title: string;
  question?: string;
  summary: string;
  body: readonly string[];
}

/**
 * The text of one article in one locale, and where it came from.
 *
 * `servedLocale` is the locale the text is ACTUALLY in, which is the whole
 * point: a page that rendered German-requested English without saying so would
 * be indistinguishable from a translation nobody proofread.
 */
export interface LocalisedArticle extends ArticleTranslation {
  slug: string;
  requestedLocale: SupportedLocale;
  servedLocale: SupportedLocale;
  /** True when the text is in the locale that was asked for. */
  inRequestedLocale: boolean;
}

/**
 * Resolve an article for a reader.
 *
 * EXACT LOCALE, THEN THE SAME LANGUAGE, THEN THE ORIGINAL. The middle step is
 * what makes this useful rather than pedantic: an article translated for
 * `de-DE` is the right article for a reader whose preference is `de-AT`, and
 * refusing it because the region differs would serve English to somebody who
 * has a German article available.
 */
export function articleForLocale(
  article: SupportArticle,
  requested: SupportedLocale,
): LocalisedArticle {
  const original: ArticleTranslation = {
    title: article.title,
    question: article.question,
    summary: article.summary,
    body: article.body,
  };

  const exact = article.translations?.[requested];
  if (exact) {
    return {
      ...exact,
      slug: article.slug,
      requestedLocale: requested,
      servedLocale: requested,
      inRequestedLocale: true,
    };
  }

  const language = languageOf(requested);
  for (const [tag, translation] of Object.entries(article.translations ?? {})) {
    if (languageOf(tag as SupportedLocale) === language) {
      return {
        ...translation,
        slug: article.slug,
        requestedLocale: requested,
        servedLocale: tag as SupportedLocale,
        /*
         * The same language, a different region. That IS the requested
         * language, so nothing needs apologising for — a British reader given
         * American English is reading English.
         */
        inRequestedLocale: true,
      };
    }
  }

  if (languageOf(article.locale) === language) {
    return {
      ...original,
      slug: article.slug,
      requestedLocale: requested,
      servedLocale: article.locale,
      inRequestedLocale: true,
    };
  }

  return {
    ...original,
    slug: article.slug,
    requestedLocale: requested,
    servedLocale: article.locale,
    inRequestedLocale: false,
  };
}

function languageOf(tag: SupportedLocale): string {
  return tag.split("-")[0].toLowerCase();
}

/**
 * How much of the Help Center exists in one locale.
 *
 * Reported rather than assumed, and shown on the Help Center itself: a reader
 * deserves to know they are looking at a section that is one article
 * translated out of twenty-one, not to discover it one article at a time.
 */
export interface LocaleCoverage {
  locale: SupportedLocale;
  translated: number;
  total: number;
  /** True when every published article is readable in this locale. */
  complete: boolean;
}

export function coverageForLocale(
  articles: readonly SupportArticle[],
  locale: SupportedLocale,
): LocaleCoverage {
  const total = articles.length;
  const translated = articles.filter(
    (article) => articleForLocale(article, locale).inRequestedLocale,
  ).length;
  return { locale, translated, total, complete: total > 0 && translated === total };
}

/**
 * What to tell a reader who asked for a language OCADE does not have.
 *
 * One sentence, naming both languages, and no apology for the fallback — the
 * English article is the useful thing on offer, and hiding it would be worse.
 */
export function describeFallback(
  localised: LocalisedArticle,
  nameOf: (locale: SupportedLocale) => string,
): string | null {
  if (localised.inRequestedLocale) return null;
  return `This article has not been translated into ${nameOf(localised.requestedLocale)} yet. It is shown in ${nameOf(localised.servedLocale)}.`;
}

export { DEFAULT_LOCALE };
