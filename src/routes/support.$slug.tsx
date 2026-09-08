import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { SUPPORT_CATEGORIES, type SupportArticle } from "@/lib/support/articles";
import { findArticleIn } from "@/lib/support/catalogue";
import { useSupportCatalogue } from "@/lib/support/use-catalogue";
import { articleForLocale, describeFallback } from "@/lib/support/article-locales";
import { describeLocale } from "@/lib/locale/supported-locales";
import { useLocale } from "@/lib/locale/use-locale";
import {
  escalationDraft,
  readAnsweredArticles,
  rememberArticleVerdict,
  type ArticleVerdict,
} from "@/lib/support/feedback";

export const Route = createFileRoute("/support/$slug")({
  /*
   * A SLUG THAT DOES NOT EXIST IS A 404, NOT AN EMPTY ARTICLE PAGE.
   *
   * Help URLs end up in support replies and bookmarks. When one stops
   * resolving, a designed not-found page tells somebody the link is dead; a
   * page with an empty body tells them the answer was deleted, which is a
   * different and usually wrong conclusion.
   */
  loader: async ({ params }) => {
    /*
     * THE CATALOGUE IS IMPORTED HERE, NOT AT THE TOP OF THE FILE.
     *
     * TanStack keeps a route's `loader` in the critical route graph — that is
     * the point of a loader, it runs before the component chunk arrives — so a
     * static import of the article authority put every help answer on first
     * paint. The budget gate caught it: twenty-five kilobytes of prose reachable
     * from the entry, on every page, for readers who never open help.
     *
     * A dynamic import keeps the loader's job (resolve the article, or a real
     * 404, before anything renders) while the answers stay behind a boundary
     * that is crossed only by somebody opening an article.
     */
    const { findArticle } = await import("@/lib/support/articles");
    const article = findArticle(params.slug);
    if (article) return { article };

    /*
     * NOT IN THE SHIPPED CATALOGUE — SO ASK BEFORE SAYING NO.
     *
     * An editor can add an article that has never been in source (§L's
     * publishing workflow), and its URL has to work the first time somebody
     * follows it from a support reply. The read happens ONLY on this branch, so
     * the ordinary case — every article that ships with the build — still
     * resolves without a network call.
     */
    const [{ getSupabaseBrowserConfiguration }, { loadArticleOverrides }] = await Promise.all([
      import("@/integrations/supabase/configuration"),
      import("@/lib/support/catalogue"),
    ]);
    if (!getSupabaseBrowserConfiguration().configured) throw notFound();
    const overrides = await loadArticleOverrides(await loadSupabaseClient());
    const { mergeArticles } = await import("@/lib/support/catalogue");
    const { SUPPORT_ARTICLES, publishedOnly } = await import("@/lib/support/articles");
    const published = publishedOnly(mergeArticles(SUPPORT_ARTICLES, overrides));
    const added = published.find((entry) => entry.slug === params.slug);
    if (!added) throw notFound();
    return { article: added };
  },
  /*
   * A named waiting state, because the loader now genuinely waits: it fetches
   * the help chunk. Rendering nothing during a chunk fetch on a slow connection
   * is the blank rectangle that reads as a broken page.
   */
  pendingComponent: () => (
    <p role="status" className="p-6 text-sm text-muted-foreground">
      Loading this help article…
    </p>
  ),
  /*
   * The loader can now genuinely reject.
   *
   * Resolving an article that is not in the shipped catalogue asks the database
   * whether an editor added one, and reaching the database is a thing that can
   * fail. A route that rendered nothing when it did would leave a blank page
   * that reads as a broken product, when the truth is narrower and worth
   * saying: OCADE could not check, and the Help Center itself is still there.
   *
   * A genuine 404 does not come through here — `notFound()` has its own path —
   * so this is only ever an unexpected failure.
   */
  errorComponent: () => (
    <div className="p-6">
      <p role="alert" className="text-sm text-destructive">
        OCADE could not open this help article. That is a problem reaching the Help Center, not an
        answer that has gone away.
      </p>
      <p className="mt-2 text-sm">
        <a className="underline" href="/support">
          Go back to the Help Center
        </a>{" "}
        — the answers that ship with OCADE are readable there whatever this was.
      </p>
    </div>
  ),
  head: ({ loaderData }) => {
    const article = loaderData?.article;
    return {
      meta: article
        ? [
            { title: `${article.title} — OCADE help` },
            { name: "description", content: article.summary },
            { property: "og:title", content: article.title },
            { property: "og:description", content: article.summary },
            { property: "og:type", content: "article" },
          ]
        : [{ title: "Help article — OCADE" }],
    };
  },
  component: ArticlePage,
});

const PLATFORM_LABEL: Record<string, string> = {
  web: "Web",
  windows: "Windows",
  macos: "macOS",
  android: "Android",
  ios: "iPhone and iPad",
  extension: "Browser extension",
};

/**
 * ONE HELP ARTICLE.
 *
 * PLAN.md §L asks each article to carry applicability, a last-updated date,
 * related reading, and a feedback control that escalates with the article's
 * context. All four are here, and the feedback control is the one that had to
 * be designed rather than copied: the usual pair of buttons that thanks you and
 * discards the answer is a fake control, because nothing is recorded anywhere.
 *
 * So "No" ESCALATES — it opens the support flow with the article already named
 * — and "Yes" is remembered on this device only, so the article stops asking,
 * and the page says that is all it does.
 */
function ArticlePage() {
  const { article: shipped } = Route.useLoaderData();
  /*
   * The article as it is TODAY.
   *
   * The loader resolved it from the shipped catalogue, which is what makes this
   * page render immediately and work with no database. If an editor has since
   * changed it, the merged version replaces it a moment later; if not, this is
   * the same object and nothing re-renders. Related articles are resolved from
   * the same list, so a link cannot point at an answer the reader is not seeing.
   */
  const catalogue = useSupportCatalogue();
  const article = findArticleIn(catalogue, shipped.slug) ?? shipped;
  const category = SUPPORT_CATEGORIES.find((entry) => entry.id === article.category);
  /*
   * THE READER'S LANGUAGE — §L's "locale support".
   *
   * Resolved on the client, after mount, for the same reason `useLocale` does:
   * reading the browser's languages during render would make the server's HTML
   * and the first client render disagree, and React resolves that by throwing
   * the server's HTML away. The first paint is the article as written; a reader
   * with a translation available sees it a moment later, which is the correct
   * trade against a page that flashes empty.
   */
  const { locale } = useLocale();
  const localised = articleForLocale(article, locale);
  const fallback = describeFallback(localised, (tag) => describeLocale(tag).label);
  const [verdict, setVerdict] = useState<ArticleVerdict | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [lookingFor, setLookingFor] = useState("");

  useEffect(() => {
    // Read after mount: touching storage during render would make the server's
    // HTML and the first client render disagree for anybody who has answered.
    setVerdict(readAnsweredArticles()[article.slug] ?? null);
  }, [article.slug]);

  const answer = (next: ArticleVerdict) => {
    setVerdict(next);
    rememberArticleVerdict(article.slug, next);
    if (next === "not-helpful") {
      setDraft(escalationDraft({ slug: article.slug, title: article.title }));
    }
  };

  return (
    <PublicPage
      eyebrow={category?.title ?? "Help"}
      title={localised.title}
      summary={localised.summary}
      structuredData={{
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: localised.title,
        description: localised.summary,
        dateModified: article.lastUpdated,
        // The language the text is ACTUALLY in, so a search engine does not
        // index English as German.
        inLanguage: localised.servedLocale,
      }}
    >
      <PublicSection title={localised.question ?? localised.title}>
        {fallback ? (
          /*
           * SAID BEFORE THE ARTICLE, not after it. Somebody who reads two
           * paragraphs of a language they did not ask for and then finds the
           * explanation has already been confused for two paragraphs.
           */
          <p className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
            {fallback}
          </p>
        ) : null}
        {localised.body.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
      </PublicSection>

      <PublicSection title="Where this applies">
        <dl className="space-y-1 text-sm">
          <div className="flex flex-wrap gap-2">
            <dt className="text-muted-foreground">Product version</dt>
            <dd>From {article.appliesFrom} onwards</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-muted-foreground">Platforms</dt>
            <dd>
              {article.platforms?.length
                ? article.platforms
                    .map((platform) => PLATFORM_LABEL[platform] ?? platform)
                    .join(", ")
                : "Every platform OCADE runs on"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-muted-foreground">Answer last changed</dt>
            <dd>
              <time dateTime={article.lastUpdated}>
                {new Date(article.lastUpdated).toLocaleDateString(undefined, {
                  dateStyle: "long",
                })}
              </time>
            </dd>
          </div>
        </dl>
      </PublicSection>

      {article.related?.length ? (
        <PublicSection title="Read next">
          <ul className="space-y-2">
            {article.related.map((slug) => {
              const related = findArticleIn(catalogue, slug);
              if (!related) return null;
              return (
                <li key={slug}>
                  <RelatedLink article={related} />
                </li>
              );
            })}
          </ul>
        </PublicSection>
      ) : null}

      <PublicSection title="Did this answer your question?">
        {verdict === "helpful" ? (
          <p className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4" aria-hidden />
            Noted on this device, so this article will stop asking. Nothing was sent anywhere.
          </p>
        ) : verdict === "not-helpful" ? (
          <>
            <p className="text-sm">
              Sorry. Add what you were trying to do, then copy this into a support ticket — it goes
              to the queue attached to your account, where somebody can answer it.
            </p>
            <label className="block text-sm">
              <span className="text-muted-foreground">What were you trying to do?</span>
              <textarea
                value={lookingFor}
                onChange={(event) => {
                  setLookingFor(event.target.value);
                  setDraft(
                    escalationDraft({
                      slug: article.slug,
                      title: article.title,
                      lookingFor: event.target.value,
                    }),
                  );
                }}
                rows={3}
                className="mt-1 w-full rounded-lg border border-white/10 bg-transparent p-2 text-foreground"
              />
            </label>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-white/10 p-3 text-xs">
              {draft ?? escalationDraft({ slug: article.slug, title: article.title })}
            </pre>
            <Link
              to="/settings/support"
              className="inline-flex min-h-11 items-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium"
            >
              Open a support ticket
            </Link>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => answer("helpful")}
                className="min-h-11 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium"
              >
                Yes, this helped
              </button>
              <button
                type="button"
                onClick={() => answer("not-helpful")}
                className="min-h-11 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium"
              >
                No, I still need help
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              &ldquo;Yes&rdquo; is remembered on this device only and is not sent anywhere — OCADE
              keeps no article-rating store, so it does not pretend to count votes. &ldquo;No&rdquo;
              prepares a support ticket with this article attached.
            </p>
          </>
        )}
      </PublicSection>

      <PublicSection title="Back to the Help Center">
        <Link
          to="/support"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> All help articles
        </Link>
      </PublicSection>
    </PublicPage>
  );
}

function RelatedLink({ article }: { article: SupportArticle }) {
  return (
    <Link
      to="/support/$slug"
      params={{ slug: article.slug }}
      className="block rounded-lg border border-white/[0.06] p-3 transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="block text-sm font-medium text-foreground">{article.title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{article.summary}</span>
    </Link>
  );
}
