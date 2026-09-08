import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, MessageSquarePlus, Search, ShieldAlert, Signal } from "lucide-react";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { coverageForLocale } from "@/lib/support/article-locales";
import { describeLocale } from "@/lib/locale/supported-locales";
import { useLocale } from "@/lib/locale/use-locale";
import { publishedOnly, SUPPORT_CATEGORIES, type SupportArticle } from "@/lib/support/articles";
import { articlesInCategoryOf, featuredArticlesIn } from "@/lib/support/catalogue";
import { useSupportCatalogue } from "@/lib/support/use-catalogue";
import { searchArticles } from "@/lib/support/search";

export const Route = createFileRoute("/support/")({
  head: () => ({
    meta: [
      { title: "Help Center — OCADE by CARCC CADANE" },
      {
        name: "description",
        content:
          "Search OCADE's help articles, or open a support ticket. Answers about accounts, sync, Offline Intelligence, privacy, billing and security.",
      },
      { property: "og:title", content: "OCADE Help Center" },
      {
        property: "og:description",
        content: "Searchable help articles and the route to a person.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HelpCenterHome,
});

const ACTION_LINK =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * THE HELP CENTER HOME.
 *
 * `/support` was a contact page: four panels of links and an honest statement
 * that no support mailbox is active. PLAN.md §L asks for it to become the Help
 * Center home, with searchable articles and categories, WITHOUT growing a second
 * answer database beside `/faq`.
 *
 * It reads from `SUPPORT_ARTICLES`, which is now the only place answers live —
 * `/faq` reads the same authority. The contact routes it used to be are still
 * here, at the bottom, because "I have read the article and I still need a
 * person" is the journey that must never dead-end.
 */
function HelpCenterHome() {
  const [query, setQuery] = useState("");
  /*
   * The shipped catalogue with any editor's changes applied — §L's publishing
   * workflow. It starts as the shipped list, so this page renders its answers
   * on the first paint and on a deployment with no database at all.
   */
  const articles = useSupportCatalogue();
  const results = useMemo(() => searchArticles(query, 12, articles), [query, articles]);
  const featured = featuredArticlesIn(articles);
  const searching = query.trim().length > 0;
  /*
   * HOW MUCH OF THIS EXISTS IN THE READER'S LANGUAGE — §L's "locale support".
   *
   * Said once, here, rather than discovered one article at a time. Somebody
   * reading their fourth English article in a row while their language is set
   * to German has learned nothing except that OCADE seems unreliable; one
   * sentence at the top is the difference between an unfinished translation and
   * a product that appears to ignore a setting.
   */
  const { locale } = useLocale();
  const coverage = useMemo(
    () => coverageForLocale(publishedOnly(articles), locale),
    [articles, locale],
  );

  return (
    <PublicPage
      eyebrow="Help Center"
      title="OCADE help"
      summary="Search the answers, or open a ticket from a signed-in account. Every article says which product version and platforms it applies to, and when its answer last changed."
      structuredData={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "OCADE Help Center",
        potentialAction: {
          "@type": "SearchAction",
          target: "/support?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      }}
    >
      {!coverage.complete ? (
        <p className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
          {coverage.translated === 0
            ? `The Help Center is not translated into ${describeLocale(locale).label} yet, so these articles are in English. OCADE would rather show you English it wrote than ${describeLocale(locale).label} it did not.`
            : `${coverage.translated} of ${coverage.total} articles are available in ${describeLocale(locale).label}. The rest are shown in English.`}
        </p>
      ) : null}

      <PublicSection title="Search the Help Center">
        {/*
         * The focus ring is on the WRAPPER, not the input.
         *
         * The input is transparent and borderless by design — the box a person
         * sees is this label. Putting `focus-visible:ring` on the input draws
         * the ring around an invisible element inside a visible one, so the
         * accessibility run found this stop with no indicator at all: a
         * keyboard user could not see where they were.
         */}
        <label className="flex items-center gap-2 rounded-lg border border-white/10 px-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Search help articles</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="sign in, sync, offline, delete my data…"
            className="min-h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>

        {searching ? (
          <div aria-live="polite">
            <p className="text-sm text-muted-foreground">
              {results.length === 0
                ? "No article matches that yet."
                : `${results.length} article${results.length === 1 ? "" : "s"} match.`}
            </p>
            {results.length === 0 ? (
              <p className="text-sm">
                Try fewer words, or open a ticket and describe what you were doing — an unanswered
                search is worth telling us about.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {results.map((match) => (
                  <li key={match.article.slug}>
                    <ArticleLink article={match.article} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </PublicSection>

      {!searching ? (
        <>
          <PublicSection title="Start here">
            <p className="text-muted-foreground">
              Chosen by the support team rather than ranked by views. OCADE does not measure how
              often an article is read, so it does not claim to know which are most popular.
            </p>
            <ul className="space-y-2">
              {featured.map((article) => (
                <li key={article.slug}>
                  <ArticleLink article={article} />
                </li>
              ))}
            </ul>
          </PublicSection>

          {SUPPORT_CATEGORIES.map((category) => {
            const inCategory = articlesInCategoryOf(articles, category.id);
            if (!inCategory.length) return null;
            return (
              <PublicSection key={category.id} title={category.title}>
                <p className="text-muted-foreground">{category.description}</p>
                <ul className="space-y-2">
                  {inCategory.map((article) => (
                    <li key={article.slug}>
                      <ArticleLink article={article} />
                    </li>
                  ))}
                </ul>
              </PublicSection>
            );
          })}
        </>
      ) : null}

      <PublicSection title="When an article is not enough">
        <p>
          Signed-in accounts can open a support case that stays attached to the account and appears
          in the OCADE administrative support queue. Categories include Account, Billing, Technical,
          Privacy, Security, Feedback, Legal, Investor and Partnership.
        </p>
        <p>
          OCADE does not publish a dedicated support, legal, privacy or security email address,
          because no such mailbox has been activated and verified. One will be published here once
          it exists and delivery to it has been confirmed.
        </p>
        <p>
          Never put passwords, one-time codes, PINs, recovery codes, private keys, full card numbers
          or payment secrets in a ticket.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/settings/support" className={ACTION_LINK}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden /> Open a support ticket
          </Link>
          <Link to="/data-rights" className={ACTION_LINK}>
            <ShieldAlert className="h-4 w-4" aria-hidden /> Data-rights request
          </Link>
          <Link to="/status" className={ACTION_LINK}>
            <Signal className="h-4 w-4" aria-hidden /> Service status
          </Link>
          <Link to="/security" className={ACTION_LINK}>
            <LifeBuoy className="h-4 w-4" aria-hidden /> Security
          </Link>
        </div>
      </PublicSection>
    </PublicPage>
  );
}

function ArticleLink({ article }: { article: SupportArticle }) {
  return (
    <Link
      to="/support/$slug"
      params={{ slug: article.slug }}
      className="block rounded-lg border border-white/[0.06] p-3 transition hover:border-primary/40 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="block text-sm font-medium text-foreground">
        {article.question ?? article.title}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{article.summary}</span>
    </Link>
  );
}
