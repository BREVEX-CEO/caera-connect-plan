/**
 * FINDING THE RIGHT HELP ARTICLE.
 *
 * PLAN.md §L asks for searchable articles and search suggestions. Both are here
 * rather than in a component, because relevance is the part that decides
 * whether somebody finds their answer or opens a ticket, and it is not
 * something you can check by looking at a screenshot.
 *
 * WHY NOT A SUBSTRING FILTER. That was the FAQ's search: a case-folded
 * `includes` over the whole entry. It ranks nothing, so the first match wins by
 * array order; it fails on "sign out" against an article titled "Signing out";
 * and it finds nothing at all for "2fa" on an article about two-factor
 * authentication unless somebody happened to type those characters. Scoring by
 * WHERE a term matched, and matching word stems rather than exact strings,
 * fixes all three without any index to keep in sync.
 */

import {
  faqView,
  publishedOnly,
  PUBLISHED_ARTICLES,
  type SupportArticle,
  type SupportCategory,
} from "./articles";
import { faqViewOf } from "./catalogue";

export interface ArticleMatch {
  article: SupportArticle;
  score: number;
}

/**
 * Fold for comparison: lower case, accents removed, punctuation to spaces.
 *
 * Accent folding so "privacy" finds an article that says "privacité" in a
 * future locale, and punctuation folding so "sign-in", "sign in" and "signin"
 * are the same query — which they are, to the person typing them.
 */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function terms(query: string): string[] {
  return fold(query).split(" ").filter(Boolean);
}

/**
 * Does a term match a word, allowing a common suffix?
 *
 * "sign" should find "signing" and "delete" should find "deleting", because
 * somebody searching for a verb rarely types the form the title happens to use.
 * Matching a prefix of at least three characters does that without pulling in
 * every word that starts with the same letter.
 */
function wordMatches(term: string, word: string): boolean {
  if (word === term) return true;
  if (term.length < 3) return false;
  return word.startsWith(term) || term.startsWith(word);
}

function fieldScore(term: string, field: string, weight: number): number {
  const words = fold(field).split(" ").filter(Boolean);
  for (const word of words) {
    if (word === term) return weight;
  }
  for (const word of words) {
    if (wordMatches(term, word)) return weight * 0.6;
  }
  return 0;
}

/**
 * Rank published articles against a query.
 *
 * EVERY TERM MUST MATCH SOMETHING. A two-word query that matches only its first
 * word is usually the wrong article, and returning it above nothing teaches
 * people the search does not work. An article that matches neither is dropped.
 */
export function searchArticles(
  query: string,
  limit = 10,
  /*
   * The set to search. Defaults to the shipped catalogue so every existing
   * caller is unchanged, and is passed explicitly by the pages that have the
   * merged list — the one with an editor's changes applied. Without this seam
   * a published edit would be readable on its own page and invisible to
   * search, which is a worse failure than not being editable at all.
   */
  articles: readonly SupportArticle[] = PUBLISHED_ARTICLES,
): ArticleMatch[] {
  const needles = terms(query);
  if (!needles.length) return [];

  const matches: ArticleMatch[] = [];
  for (const article of publishedOnly(articles)) {
    let total = 0;
    let matchedEveryTerm = true;
    for (const term of needles) {
      const best = Math.max(
        // Title and question are what the person is most likely echoing.
        fieldScore(term, article.title, 10),
        fieldScore(term, article.question ?? "", 10),
        fieldScore(term, article.keywords.join(" "), 8),
        fieldScore(term, article.summary, 4),
        fieldScore(term, article.body.join(" "), 1),
      );
      if (best === 0) {
        matchedEveryTerm = false;
        break;
      }
      total += best;
    }
    if (!matchedEveryTerm) continue;
    // A featured article breaks a tie, and cannot outrank a better match.
    if (article.featured) total += 0.5;
    matches.push({ article, score: total });
  }

  return matches
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
    .slice(0, limit);
}

/**
 * Suggestions while somebody types.
 *
 * Deliberately the same ranking as the full search: a suggestion list ordered
 * differently from the results it leads to is worse than none, because the
 * article somebody saw first disappears the moment they press Enter.
 */
export function suggestArticles(
  query: string,
  limit = 5,
  articles: readonly SupportArticle[] = PUBLISHED_ARTICLES,
): SupportArticle[] {
  return searchArticles(query, limit, articles).map((match) => match.article);
}

/**
 * The FAQ view, narrowed by a query.
 *
 * It lives here rather than beside `faqView` so the FAQ and the Help Center
 * rank by the SAME relevance rules. Two search implementations over one set of
 * articles is the duplicate-authority problem in miniature: the same query
 * finds different answers depending on which page you typed it into.
 */
export function faqViewMatching(
  query: string,
  articles: readonly SupportArticle[] = PUBLISHED_ARTICLES,
): { category: SupportCategory; articles: SupportArticle[] }[] {
  const groups = articles === PUBLISHED_ARTICLES ? faqView() : faqViewOf(articles);
  if (!query.trim()) return groups;
  const allowed = new Set(
    searchArticles(query, articles.length, articles).map((m) => m.article.slug),
  );
  return groups
    .map((group) => ({
      ...group,
      articles: group.articles.filter((article) => allowed.has(article.slug)),
    }))
    .filter((group) => group.articles.length > 0);
}
