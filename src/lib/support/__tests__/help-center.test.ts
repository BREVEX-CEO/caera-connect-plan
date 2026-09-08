import { readFileSync } from "node:fs";
import { isSupportedLocale } from "@/lib/locale/supported-locales";
import { describe, expect, it } from "vitest";
import {
  articlesInCategory,
  faqView,
  featuredArticles,
  findArticle,
  publishedOnly,
  PUBLISHED_ARTICLES,
  SUPPORT_ARTICLES,
  SUPPORT_CATEGORIES,
  type SupportArticle,
} from "../articles";
import { faqViewMatching, searchArticles, suggestArticles } from "../search";
import {
  escalationDraft,
  readAnsweredArticles,
  rememberArticleVerdict,
  type FeedbackStorage,
} from "../feedback";

/**
 * THE HELP CENTER'S INTEGRITY CHECKS.
 *
 * PLAN.md §L asks for "broken-link and stale-version checks". A help centre
 * fails quietly: a related-article link that points at a slug somebody renamed
 * renders as nothing, a draft that is linked from a published article is a dead
 * end, and a date nobody maintains slowly turns every date on the site into
 * noise. None of it breaks the build and none of it is visible in review.
 *
 * So the structure is asserted here rather than trusted.
 */

describe("the article catalogue", () => {
  it("was found at all, so a broken scan cannot pass", () => {
    expect(SUPPORT_ARTICLES.length).toBeGreaterThan(15);
    expect(PUBLISHED_ARTICLES.length).toBeGreaterThan(15);
    expect(SUPPORT_CATEGORIES.length).toBeGreaterThan(5);
  });

  it("gives every article a unique, URL-safe, permanent slug", () => {
    // A slug ends up in a support reply and a bookmark. Reusing one for
    // different content silently changes what those links say.
    const slugs = SUPPORT_ARTICLES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("puts every article in a category that exists", () => {
    const known = new Set(SUPPORT_CATEGORIES.map((category) => category.id));
    for (const article of SUPPORT_ARTICLES) {
      expect(known.has(article.category), `${article.slug} -> ${article.category}`).toBe(true);
    }
  });

  it("has no broken related-article link", () => {
    // The check §L asks for by name. A related link to a renamed or
    // unpublished slug renders as nothing at all, which looks like an article
    // with no related reading rather than a mistake.
    for (const article of PUBLISHED_ARTICLES) {
      for (const slug of article.related ?? []) {
        expect(findArticle(slug), `${article.slug} links to missing "${slug}"`).toBeTruthy();
      }
    }
  });

  it("never links a published article to a draft", () => {
    const drafts = new Set(
      SUPPORT_ARTICLES.filter((article) => article.status === "draft").map((a) => a.slug),
    );
    for (const article of PUBLISHED_ARTICLES) {
      for (const slug of article.related ?? []) {
        expect(drafts.has(slug), `${article.slug} links to draft "${slug}"`).toBe(false);
      }
    }
  });

  it("never links an article to itself", () => {
    for (const article of PUBLISHED_ARTICLES) {
      expect(article.related ?? []).not.toContain(article.slug);
    }
  });

  it("carries a real last-changed date and applicability on every article", () => {
    // The stale-version check. A date that does not parse, or one in the
    // future, is worse than none: it is a confident wrong answer to "is this
    // still current?".
    const today = Date.now();
    for (const article of SUPPORT_ARTICLES) {
      expect(article.lastUpdated, article.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const at = Date.parse(article.lastUpdated);
      expect(Number.isNaN(at), `${article.slug} has an unparseable date`).toBe(false);
      expect(at, `${article.slug} is dated in the future`).toBeLessThanOrEqual(today + 86_400_000);
      expect(article.appliesFrom, article.slug).toMatch(/^\d+\.\d+$/);
      // A full tag, and one the locale authority recognises. `en` matched
      // nothing in SUPPORTED_LOCALES, so every comparison against a reader's
      // locale was against a value that does not exist.
      expect(isSupportedLocale(article.locale), `${article.slug}: ${article.locale}`).toBe(true);
    }
  });

  it("gives every article a summary and a body a person can read", () => {
    for (const article of PUBLISHED_ARTICLES) {
      expect(article.summary.length, article.slug).toBeGreaterThan(20);
      expect(article.body.length, article.slug).toBeGreaterThan(0);
      for (const paragraph of article.body) {
        expect(paragraph.trim().length, article.slug).toBeGreaterThan(20);
      }
      expect(article.keywords.length, article.slug).toBeGreaterThan(1);
    }
  });

  it("puts at least one article in every category it advertises", () => {
    // An empty category on the Help Center home is a dead heading.
    for (const category of SUPPORT_CATEGORIES) {
      expect(articlesInCategory(category.id).length, category.id).toBeGreaterThan(0);
    }
  });

  it("hides a draft from every reader-facing path", () => {
    /*
     * TESTED WITH A DRAFT IN HAND, NOT OVER THE REAL LIST.
     *
     * The catalogue contains no drafts today, so looping over it and asserting
     * nothing would pass without exercising the rule — and would keep passing
     * on the day somebody removed the filter. This gives the rule a draft to
     * refuse, which is the only version that can fail.
     */
    const draft: SupportArticle = {
      slug: "not-ready-yet",
      title: "Not ready yet",
      question: "Is this ready?",
      summary: "An article that is not finished and must not be readable.",
      category: "getting-started",
      body: ["This paragraph is long enough to be a real body but is not published."],
      keywords: ["draft", "unpublished"],
      appliesFrom: "1.0",
      lastUpdated: "2026-09-03",
      status: "draft",
      locale: "en-GB",
    };
    const published: SupportArticle = { ...draft, slug: "ready", status: "published" };

    const kept = publishedOnly([draft, published]).map((article) => article.slug);
    expect(kept).toEqual(["ready"]);

    // And the real catalogue's reader-facing surfaces only ever show published.
    for (const article of PUBLISHED_ARTICLES) expect(article.status).toBe("published");
    for (const group of faqView()) {
      for (const article of group.articles) expect(article.status).toBe("published");
    }
    expect(SUPPORT_ARTICLES.every((article) => findArticle(article.slug) !== undefined)).toBe(
      PUBLISHED_ARTICLES.length === SUPPORT_ARTICLES.length,
    );
  });

  it("offers a hand-picked start list rather than an invented popularity ranking", () => {
    // OCADE has no article-view metrics. "Most popular" would be a statistic
    // nothing measured.
    const featured = featuredArticles();
    expect(featured.length).toBeGreaterThan(2);
    for (const article of featured) expect(article.status).toBe("published");
    const home = readFileSync("src/routes/support.index.tsx", "utf8");
    expect(home).toMatch(/Chosen by the support team rather than ranked by views/);
  });
});

describe("there is only one set of answers", () => {
  it("has no separate FAQ database module", () => {
    // PLAN.md §L: "No duplicate FAQ database or support system." `public-faq.ts`
    // was exactly that, and it is gone rather than left beside its successor.
    expect(() => readFileSync("src/lib/public-faq.ts", "utf8")).toThrow();
  });

  it("makes the FAQ a view of the published articles", () => {
    const inFaq = faqView().flatMap((group) => group.articles);
    const withQuestions = PUBLISHED_ARTICLES.filter((article) => article.question);
    expect(inFaq.map((a) => a.slug).sort()).toEqual(withQuestions.map((a) => a.slug).sort());
  });
});

describe("finding an answer", () => {
  it("finds the sign-in article from words a person would actually type", () => {
    for (const query of ["sign in", "signin", "log in", "login", "how do I sign in"]) {
      const top = searchArticles(query)[0];
      expect(top, `nothing found for "${query}"`).toBeTruthy();
    }
    expect(searchArticles("sign in")[0].article.slug).toBe("how-to-sign-in");
  });

  it("finds articles by keyword when the words are not in the text", () => {
    // "2fa" appears in no title or body; it is what people type.
    expect(searchArticles("2fa")[0].article.slug).toBe("second-factor-setup");
    expect(searchArticles("locked out")[0].article.slug).toBe("lost-second-factor");
  });

  it("matches word stems, so a verb form does not lose the article", () => {
    expect(searchArticles("deleting my account")[0].article.slug).toBe("delete-account");
  });

  it("is accent- and case-insensitive and ignores punctuation", () => {
    const plain = searchArticles("sign in").map((m) => m.article.slug);
    for (const variant of ["SIGN-IN", "  sign   in  ", "sign  in!"]) {
      expect(searchArticles(variant).map((m) => m.article.slug)).toEqual(plain);
    }
  });

  it("requires every term to match, rather than returning a near-miss", () => {
    // A two-word query that matched only its first word used to return the
    // wrong article confidently, which teaches people the search is broken.
    expect(searchArticles("sign in zzzzzz")).toEqual([]);
  });

  it("returns nothing for an empty query rather than everything", () => {
    expect(searchArticles("   ")).toEqual([]);
  });

  it("ranks a title match above a body mention", () => {
    const results = searchArticles("offline");
    expect(results[0].article.slug).toBe("offline-intelligence-what-it-is");
  });

  it("suggests exactly what the full search would show, in the same order", () => {
    // A suggestion list ordered differently from its own results makes the
    // article somebody saw first disappear when they press Enter.
    const query = "delete";
    expect(suggestArticles(query, 3).map((a) => a.slug)).toEqual(
      searchArticles(query, 3).map((m) => m.article.slug),
    );
  });

  it("narrows the FAQ view with the same ranking the Help Center uses", () => {
    const groups = faqViewMatching("offline");
    const slugs = groups.flatMap((group) => group.articles.map((a) => a.slug));
    expect(slugs).toContain("offline-intelligence-what-it-is");
    expect(slugs).not.toContain("how-to-sign-in");
  });
});

describe("article feedback", () => {
  function memory(seed: Record<string, string> = {}): FeedbackStorage {
    const entries = { ...seed };
    return {
      getItem: (key) => (key in entries ? entries[key] : null),
      setItem: (key, value) => {
        entries[key] = value;
      },
    };
  }

  it("remembers an answer on this device so the article stops asking", () => {
    const storage = memory();
    rememberArticleVerdict("delete-account", "helpful", storage);
    expect(readAnsweredArticles(storage)["delete-account"]).toBe("helpful");
  });

  it("discards a stored value that is not a verdict", () => {
    const storage = memory({
      "ocade.support.article-feedback": JSON.stringify({ a: "helpful", b: "sabotage", c: 7 }),
    });
    expect(readAnsweredArticles(storage)).toEqual({ a: "helpful" });
  });

  it("survives storage that throws and storage that does not exist", () => {
    const hostile: FeedbackStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("full");
      },
    };
    expect(readAnsweredArticles(hostile)).toEqual({});
    expect(() => rememberArticleVerdict("x", "helpful", hostile)).not.toThrow();
    expect(readAnsweredArticles(null)).toEqual({});
  });

  it("escalates with the article's context, and asks for no credentials", () => {
    const draft = escalationDraft({
      slug: "delete-account",
      title: "Deleting your account and data",
      lookingFor: "export before deleting",
    });
    expect(draft).toContain("/support/delete-account");
    expect(draft).toContain("Deleting your account and data");
    expect(draft).toContain("export before deleting");
    expect(draft).toMatch(/do not include passwords/i);
  });

  it("never reads anything out of the session into the draft", () => {
    // A help form that quietly attaches account details is a disclosure the
    // person did not ask for.
    const draft = escalationDraft({ slug: "s", title: "t" });
    expect(draft).not.toMatch(/[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(draft).not.toMatch(/token|session|bearer/i);
  });

  it("does not claim a vote was counted", () => {
    const page = readFileSync("src/routes/support.$slug.tsx", "utf8").replace(/\s+/g, " ");
    expect(page).toMatch(/remembered on this device only and is not sent anywhere/i);
    expect(page).toMatch(/keeps no article-rating store/i);
    expect(page).not.toMatch(/thanks for your feedback/i);
  });
});
