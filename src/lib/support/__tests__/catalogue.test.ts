import { describe, expect, it } from "vitest";
import {
  faqViewOf,
  featuredArticlesIn,
  findArticleIn,
  articlesInCategoryOf,
  isSupportCategoryId,
  keywordsFrom,
  mergeArticles,
  paragraphsFrom,
  textFrom,
  type ArticleOverride,
} from "../catalogue";
import { SUPPORT_ARTICLES, type SupportArticle } from "../articles";
import { searchArticles } from "../search";

/**
 * The Help Center with an editor's changes applied.
 *
 * The failure this guards against is not a crash. It is an override that half
 * applies: an answer that is current on its own page and stale in search, a
 * draft that is invisible on the index and reachable by URL, or a published
 * edit that quietly loses the article's version applicability because the merge
 * rebuilt the object instead of amending it.
 */

const source: SupportArticle[] = [
  {
    slug: "what-is-ocade",
    title: "What OCADE is",
    question: "What is OCADE?",
    summary: "The short answer.",
    category: "getting-started",
    body: ["Original body."],
    keywords: ["ocade"],
    platforms: ["web", "windows"],
    appliesFrom: "1.0",
    lastUpdated: "2026-01-01",
    related: ["signing-in"],
    status: "published",
    featured: true,
    locale: "en-GB",
  },
  {
    slug: "signing-in",
    title: "Signing in",
    summary: "How to get in.",
    category: "account-and-sign-in",
    body: ["Use your password."],
    keywords: ["sign in"],
    appliesFrom: "1.0",
    lastUpdated: "2026-01-01",
    status: "published",
    locale: "en-GB",
  },
];

const override = (over: Partial<ArticleOverride> & { slug: string }): ArticleOverride => ({
  title: "Edited title",
  summary: "Edited summary.",
  category: "getting-started",
  body: ["Edited body."],
  keywords: ["edited"],
  status: "published",
  updatedAt: "2026-09-04T10:00:00.000Z",
  ...over,
});

describe("an override replaces what an editor may change, and nothing else", () => {
  it("replaces the text and leaves the applicability alone", () => {
    const merged = mergeArticles(source, [override({ slug: "what-is-ocade" })]);
    const article = merged.find((entry) => entry.slug === "what-is-ocade");
    expect(article?.title).toEqual("Edited title");
    expect(article?.body).toEqual(["Edited body."]);
    // The fields no form offers survive: renaming a slug turns support replies
    // and bookmarks into 404s, and the rest are reviewed changes.
    expect(article?.slug).toEqual("what-is-ocade");
    expect(article?.platforms).toEqual(["web", "windows"]);
    expect(article?.appliesFrom).toEqual("1.0");
    expect(article?.related).toEqual(["signing-in"]);
    expect(article?.question).toEqual("What is OCADE?");
    expect(article?.featured).toBe(true);
  });

  it("moves the last-updated date to the day the answer actually changed", () => {
    const merged = mergeArticles(source, [override({ slug: "what-is-ocade" })]);
    expect(merged.find((entry) => entry.slug === "what-is-ocade")?.lastUpdated).toEqual(
      "2026-09-04",
    );
  });

  it("leaves an article with no override exactly as it was", () => {
    const merged = mergeArticles(source, [override({ slug: "what-is-ocade" })]);
    expect(merged.find((entry) => entry.slug === "signing-in")).toEqual(source[1]);
  });

  it("keeps the source order rather than moving what was edited", () => {
    const merged = mergeArticles(source, [override({ slug: "signing-in" })]);
    expect(merged.map((entry) => entry.slug)).toEqual(["what-is-ocade", "signing-in"]);
  });
});

describe("an override for a slug nobody shipped becomes a new article", () => {
  it("is added, with defaults for the fields no form asks about", () => {
    const merged = mergeArticles(source, [override({ slug: "refunds", title: "Refunds" })]);
    const added = merged.find((entry) => entry.slug === "refunds");
    expect(added?.title).toEqual("Refunds");
    expect(added?.appliesFrom).toEqual("1.0");
    expect(added?.locale).toEqual("en-GB");
    expect(merged).toHaveLength(3);
  });
});

describe("a draft is invisible everywhere a reader looks", () => {
  const drafted = mergeArticles(source, [
    override({ slug: "what-is-ocade", status: "draft", title: "Half written" }),
  ]);

  it("is not routable", () => {
    expect(findArticleIn(drafted, "what-is-ocade")).toBeUndefined();
  });

  it("is not listed in its category", () => {
    expect(articlesInCategoryOf(drafted, "getting-started")).toEqual([]);
  });

  it("is not featured", () => {
    expect(featuredArticlesIn(drafted)).toEqual([]);
  });

  it("is not in the FAQ", () => {
    const slugs = faqViewOf(drafted).flatMap((group) =>
      group.articles.map((article) => article.slug),
    );
    expect(slugs).not.toContain("what-is-ocade");
  });

  it("is not findable by search", () => {
    // The one that would be easiest to miss: an answer unpublished on every
    // page and still reachable by typing its words into the box.
    expect(searchArticles("half written", 10, drafted)).toEqual([]);
  });
});

describe("a published edit reaches search as well as its own page", () => {
  it("is found by a word that appears only in the new text", () => {
    const merged = mergeArticles(source, [
      override({ slug: "signing-in", title: "Passkeys", body: ["Use a passkey."], keywords: [] }),
    ]);
    const found = searchArticles("passkey", 5, merged);
    expect(found.map((match) => match.article.slug)).toContain("signing-in");
  });

  it("stops being found by a word only the old text had", () => {
    const merged = mergeArticles(source, [
      override({ slug: "signing-in", title: "Passkeys", body: ["Use a passkey."], keywords: [] }),
    ]);
    // Otherwise search leads people to an answer that no longer says that.
    expect(searchArticles("password", 5, merged).map((m) => m.article.slug)).not.toContain(
      "signing-in",
    );
  });
});

describe("the shipped catalogue is the fallback", () => {
  it("is returned unchanged when there are no overrides", () => {
    expect(mergeArticles(SUPPORT_ARTICLES, [])).toEqual([...SUPPORT_ARTICLES]);
  });
});

describe("what the editor's form turns into rows", () => {
  it("splits paragraphs on blank lines and drops the empties", () => {
    expect(paragraphsFrom("One.\n\nTwo.\n\n\n\nThree.\n")).toEqual(["One.", "Two.", "Three."]);
  });

  it("round-trips back into the textarea", () => {
    expect(paragraphsFrom(textFrom(["One.", "Two."]))).toEqual(["One.", "Two."]);
  });

  it("lower-cases and de-duplicates keywords", () => {
    // Search lower-cases what it matches against, so a list holding "Refund"
    // and "refund" is one entry pretending to be two.
    expect(keywordsFrom("Refund, refund , billing,  ,BILLING")).toEqual(["refund", "billing"]);
  });

  it("recognises the eight real categories and nothing else", () => {
    expect(isSupportCategoryId("security")).toBe(true);
    expect(isSupportCategoryId("miscellaneous")).toBe(false);
  });
});
