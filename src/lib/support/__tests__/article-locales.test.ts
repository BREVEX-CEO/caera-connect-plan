import { describe, expect, it } from "vitest";
import { articleForLocale, coverageForLocale, describeFallback } from "../article-locales";
import { PUBLISHED_ARTICLES, SUPPORT_ARTICLES, findArticle } from "../articles";
import { SUPPORTED_LOCALES, describeLocale } from "@/lib/locale/supported-locales";

/**
 * READING A HELP ARTICLE IN A LANGUAGE — PLAN.md §L's "locale support".
 *
 * The thing being protected here is not coverage; it is HONESTY about coverage.
 * A Help Center that served English to a German reader without saying so would
 * be indistinguishable from one whose German was written by a machine and never
 * proofread, and the reader could not tell which they were looking at.
 */

const nameOf = (tag: Parameters<typeof describeLocale>[0]) => describeLocale(tag).label;

describe("resolving an article for a reader", () => {
  it("gives the translation when one exists", () => {
    const article = findArticle("plans-and-what-they-cost")!;
    const localised = articleForLocale(article, "en-IN");
    expect(localised.inRequestedLocale).toBe(true);
    expect(localised.servedLocale).toBe("en-IN");
    expect(localised.body.join(" ")).toMatch(/rupees/);
  });

  it("gives the original when no translation exists, and says so", () => {
    const article = findArticle("plans-and-what-they-cost")!;
    const localised = articleForLocale(article, "de-DE");
    expect(localised.inRequestedLocale).toBe(false);
    expect(localised.servedLocale).toBe("en-GB");
    expect(describeFallback(localised, nameOf)).toMatch(/not been translated into German/i);
    // And still gives them the article. An empty page would be worse than
    // English they can paste into a translator themselves.
    expect(localised.body.length).toBeGreaterThan(0);
  });

  it("says nothing when nothing needs saying", () => {
    const article = findArticle("plans-and-what-they-cost")!;
    expect(describeFallback(articleForLocale(article, "en-IN"), nameOf)).toBeNull();
  });

  /**
   * THE CASE A STRICTER MATCH WOULD GET WRONG. A British reader given an
   * article written in `en-GB` is reading English, and so is one given `en-US`.
   * Apologising for that would be noise; refusing it would be worse.
   */
  it("treats another region of the same language as the requested language", () => {
    const article = findArticle("what-is-ocade")!;
    const localised = articleForLocale(article, "en-US");
    expect(localised.servedLocale).toBe("en-GB");
    expect(localised.inRequestedLocale).toBe(true);
    expect(describeFallback(localised, nameOf)).toBeNull();
  });

  it("prefers an exact locale over another region of the same language", () => {
    const article = findArticle("plans-and-what-they-cost")!;
    expect(articleForLocale(article, "en-IN").servedLocale).toBe("en-IN");
  });

  it("keeps the slug whatever the language, so a shared link keeps working", () => {
    const article = findArticle("plans-and-what-they-cost")!;
    for (const locale of SUPPORTED_LOCALES) {
      expect(articleForLocale(article, locale.tag).slug).toBe("plans-and-what-they-cost");
    }
  });
});

describe("coverage, reported rather than assumed", () => {
  it("is complete for English, because every article is written in it", () => {
    for (const locale of ["en-GB", "en-US", "en-IN"] as const) {
      const coverage = coverageForLocale(PUBLISHED_ARTICLES, locale);
      expect(coverage.complete, locale).toBe(true);
      expect(coverage.translated).toBe(coverage.total);
    }
  });

  it("is honest about the languages with no translations", () => {
    for (const locale of ["hi-IN", "de-DE", "fr-FR", "es-ES", "ja-JP"] as const) {
      const coverage = coverageForLocale(PUBLISHED_ARTICLES, locale);
      expect(coverage.complete, locale).toBe(false);
      // Zero, and said out loud. The gap ledger records the translation work as
      // work; this is what a reader is shown in the meantime.
      expect(coverage.translated, locale).toBe(0);
      expect(coverage.total).toBeGreaterThan(10);
    }
  });
});

describe("the mechanism is exercised by a real article, not left as dead code", () => {
  it("has at least one article with a genuine translation", () => {
    // Written, not machine-generated: §26 settled that OCADE does not ship
    // machine translation, and an article somebody reads while stuck is the
    // worst place to break that. The one that exists is the other English where
    // the wording genuinely differs.
    const translated = SUPPORT_ARTICLES.filter(
      (article) => Object.keys(article.translations ?? {}).length > 0,
    );
    expect(translated.length).toBeGreaterThan(0);
  });

  it("gives every translation the same shape as the original", () => {
    for (const article of SUPPORT_ARTICLES) {
      for (const [tag, translation] of Object.entries(article.translations ?? {})) {
        expect(translation.title.trim().length, `${article.slug} ${tag}`).toBeGreaterThan(0);
        expect(translation.summary.trim().length, `${article.slug} ${tag}`).toBeGreaterThan(0);
        expect(translation.body.length, `${article.slug} ${tag}`).toBeGreaterThan(0);
        // A translation that dropped the question would silently remove the
        // article from /faq for that language.
        if (article.question) {
          expect(translation.question, `${article.slug} ${tag} lost its question`).toBeTruthy();
        }
      }
    }
  });

  it("translates into a locale OCADE actually supports", () => {
    const supported = new Set(SUPPORTED_LOCALES.map((locale) => locale.tag));
    for (const article of SUPPORT_ARTICLES) {
      for (const tag of Object.keys(article.translations ?? {})) {
        expect(supported.has(tag as never), `${article.slug}: ${tag}`).toBe(true);
      }
    }
  });
});
