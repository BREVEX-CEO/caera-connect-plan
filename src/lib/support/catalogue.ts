/**
 * THE HELP CENTER AS IT IS ACTUALLY READ — PLAN.md §L, and §G's help-content
 * management.
 *
 * `articles.ts` is the source catalogue: twenty-one answers written in
 * TypeScript, shipped with the build, and readable on a deployment with no
 * database at all. That property is why it stays. `/support` is a public page,
 * and answers that disappear when Supabase is unreachable are worse than
 * answers nobody can edit — the person who most needs help is the one having a
 * bad day.
 *
 * So an override SUPPLEMENTS the catalogue rather than replacing it:
 *
 *   - A row for a slug that exists in source replaces its EDITABLE fields —
 *     title, summary, category, body, keywords, status. Everything else, the
 *     things an editor has no business changing from a form (the slug, the
 *     version it applies from, the platforms, the related reading, the locale),
 *     stays exactly as the catalogue declares it.
 *   - A row for a slug that does not exist in source becomes a new article,
 *     with the defaults below stated once, here.
 *   - An article with no row keeps precisely the behaviour it has today.
 *
 * THE MERGE IS PURE, and the functions below take the article list rather than
 * reaching for a module-level one. That is the change that made this possible:
 * every reader used to close over `PUBLISHED_ARTICLES` directly, so there was
 * no seam at which a different list could arrive, and no way to test the merged
 * case without a database.
 */
import {
  publishedOnly,
  SUPPORT_CATEGORIES,
  type SupportArticle,
  type SupportCategory,
  type SupportCategoryId,
} from "./articles";

/** What an editor may change, and nothing else. */
export interface ArticleOverride {
  slug: string;
  title: string;
  summary: string;
  category: SupportCategoryId;
  body: readonly string[];
  keywords: readonly string[];
  status: "draft" | "published";
  updatedAt: string;
}

/**
 * What a NEW article gets for the fields no form asks about.
 *
 * `appliesFrom` is the current major version rather than the version the
 * article happens to be written under, because an editor adding an answer today
 * is answering about today's product. `locale` is the deployment's own writing
 * language; §L's locale support is about TRANSLATIONS of an article, which
 * arrive as text rather than through this form.
 */
const NEW_ARTICLE_DEFAULTS = {
  appliesFrom: "1.0",
  locale: "en-GB",
} as const;

export function isSupportCategoryId(value: unknown): value is SupportCategoryId {
  return typeof value === "string" && SUPPORT_CATEGORIES.some((category) => category.id === value);
}

/**
 * The catalogue with the editors' changes applied.
 *
 * Order is the source catalogue's, then anything new, so an existing article
 * that was edited does not jump to the end of its category and a page that
 * somebody knows the shape of stays the shape they know.
 */
export function mergeArticles(
  source: readonly SupportArticle[],
  overrides: readonly ArticleOverride[],
): SupportArticle[] {
  const byslug = new Map(overrides.map((override) => [override.slug, override]));
  const seen = new Set<string>();

  const merged = source.map((article) => {
    const override = byslug.get(article.slug);
    if (!override) return article;
    seen.add(article.slug);
    return {
      ...article,
      title: override.title,
      summary: override.summary,
      category: override.category,
      body: override.body,
      keywords: override.keywords,
      status: override.status,
      // The day the ANSWER changed, which is exactly what an override is.
      lastUpdated: override.updatedAt.slice(0, 10),
    } satisfies SupportArticle;
  });

  for (const override of overrides) {
    if (seen.has(override.slug)) continue;
    merged.push({
      slug: override.slug,
      title: override.title,
      summary: override.summary,
      category: override.category,
      body: override.body,
      keywords: override.keywords,
      status: override.status,
      lastUpdated: override.updatedAt.slice(0, 10),
      ...NEW_ARTICLE_DEFAULTS,
    });
  }

  return merged;
}

/* ------------------------------------------------------------- readers -- */

export function findArticleIn(
  articles: readonly SupportArticle[],
  slug: string,
): SupportArticle | undefined {
  return publishedOnly(articles).find((article) => article.slug === slug);
}

export function articlesInCategoryOf(
  articles: readonly SupportArticle[],
  category: SupportCategoryId,
): SupportArticle[] {
  return publishedOnly(articles).filter((article) => article.category === category);
}

export function featuredArticlesIn(articles: readonly SupportArticle[]): SupportArticle[] {
  return publishedOnly(articles).filter((article) => article.featured);
}

export function faqViewOf(
  articles: readonly SupportArticle[],
): { category: SupportCategory; articles: SupportArticle[] }[] {
  const published = publishedOnly(articles);
  return SUPPORT_CATEGORIES.map((category) => ({
    category,
    articles: published.filter((article) => article.category === category.id && article.question),
  })).filter((group) => group.articles.length > 0);
}

/* -------------------------------------------------------------- reading -- */

/** How many overrides one deployment may have. Far above any editorial reality. */
export const OVERRIDE_LIMIT = 500;

type OverrideReader = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (
        column: string,
        options: { ascending: boolean },
      ) => { limit: (count: number) => PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
};

/**
 * Read the overrides a visitor is allowed to see.
 *
 * Row-level security decides which those are: everybody sees published rows,
 * administrators additionally see drafts. So the SAME function serves the
 * public page and the admin screen, and the difference is the caller's token
 * rather than a flag somebody could pass wrongly.
 *
 * Returns an empty list on any failure, which is the fallback the whole design
 * rests on: a Help Center that fails to render because its override query
 * failed would be a worse product than one that cannot be edited.
 */
export async function loadArticleOverrides(client: unknown): Promise<ArticleOverride[]> {
  try {
    const reader = client as OverrideReader;
    const { data, error } = await reader
      .from("ocade_support_articles")
      .select("slug, title, summary, category, body, keywords, status, updated_at")
      .order("slug", { ascending: true })
      .limit(OVERRIDE_LIMIT);
    if (error || !Array.isArray(data)) return [];

    const overrides: ArticleOverride[] = [];
    for (const row of data as Record<string, unknown>[]) {
      const category = row["category"];
      const status = row["status"];
      // A row naming a category or a state the product does not have is
      // dropped rather than rendered: an article filed under nothing would be
      // published, unreachable from any page, and findable only by search.
      if (!isSupportCategoryId(category)) continue;
      if (status !== "draft" && status !== "published") continue;
      overrides.push({
        slug: String(row["slug"] ?? ""),
        title: String(row["title"] ?? ""),
        summary: String(row["summary"] ?? ""),
        category,
        body: asStrings(row["body"]),
        keywords: asStrings(row["keywords"]),
        status,
        updatedAt: String(row["updated_at"] ?? ""),
      });
    }
    return overrides;
  } catch {
    return [];
  }
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/* ------------------------------------------------- what a form produces -- */

/**
 * Turn a body typed into a textarea into paragraphs.
 *
 * Blank lines separate them, and runs of blank lines count once — somebody
 * pressing Enter twice out of habit should not publish an empty paragraph, and
 * the schema counts paragraphs against a cap.
 */
export function paragraphsFrom(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** And back again, so an editor opens what they last published. */
export function textFrom(paragraphs: readonly string[]): string {
  return paragraphs.join("\n\n");
}

/**
 * Keywords typed as a comma-separated list.
 *
 * Lower-cased and de-duplicated, because the search lower-cases what it matches
 * against and a list holding "Refund" and "refund" is one entry pretending to
 * be two.
 */
export function keywordsFrom(text: string): string[] {
  const seen = new Set<string>();
  for (const entry of text.split(",")) {
    const keyword = entry.trim().toLowerCase();
    if (keyword) seen.add(keyword);
  }
  return [...seen];
}
