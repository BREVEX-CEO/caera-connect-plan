import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";
import { PrelaunchSubscription } from "@/components/public/PrelaunchSubscription";
import { filterPublicArticles, PUBLIC_ARTICLES } from "@/lib/public-content";

export const Route = createFileRoute("/blog/")({
  component: BlogPage,
});

const TAGS = ["All", ...new Set(PUBLIC_ARTICLES.flatMap((article) => article.tags))];

function BlogPage() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("All");
  const articles = useMemo(() => filterPublicArticles(query, tag), [query, tag]);
  return (
    <PublicPage
      eyebrow="OCADE journal"
      title="How OCADE is being built"
      summary="Original pre-launch notes about local intelligence, supervised computer work, privacy and the evidence required before a production claim is made."
    >
      <nav aria-label="Journal topics" className="flex flex-wrap gap-2">
        {TAGS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tag === value}
            onClick={() => setTag(value)}
            className={`min-h-9 rounded-full border px-3 text-xs ${tag === value ? "border-primary bg-primary/15 text-foreground" : "border-border/70 text-muted-foreground"}`}
          >
            {value}
          </button>
        ))}
      </nav>
      <div className="grid gap-5 lg:grid-cols-[1fr_16rem]">
        <section aria-labelledby="posts-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="posts-title" className="text-xl font-semibold">Latest posts</h2>
            <label className="text-xs text-muted-foreground">
              Search posts
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="ml-2 min-h-9 rounded-md border border-border/70 bg-background px-3 text-sm text-foreground"
              />
            </label>
          </div>
          <div className="mt-4 space-y-4">
            {articles.map((article) => (
              <article key={article.slug} className="overflow-hidden rounded-2xl border border-white/7 bg-white/[0.018]">
                <img src={article.thumbnail} alt="" width={2172} height={724} className="aspect-[3/1] w-full object-cover" />
                <div className="p-5">
                  <div className="flex flex-wrap gap-2 text-[11px] text-primary">
                    {article.tags.map((item) => <span key={item}>{item}</span>)}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold">
                    <Link to="/blog/$slug" params={{ slug: article.slug }} className="hover:underline">
                      {article.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{article.description}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {article.author} ·{" "}
                    {new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${article.published}T00:00:00Z`))}
                  </p>
                </div>
              </article>
            ))}
            {!articles.length ? (
              <p className="rounded-xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">No published post matches those filters.</p>
            ) : null}
          </div>
          <nav aria-label="Journal pages" className="mt-5 flex justify-between">
            <button type="button" disabled aria-label="Previous page unavailable; there is only one page" className="min-h-9 rounded-md border border-border/70 px-3 text-xs disabled:opacity-40">Previous</button>
            <span className="text-xs text-muted-foreground">Page 1 of 1</span>
            <button type="button" disabled aria-label="Next page unavailable; there is only one page" className="min-h-9 rounded-md border border-border/70 px-3 text-xs disabled:opacity-40">Next</button>
          </nav>
        </section>
        <PrelaunchSubscription />
      </div>
    </PublicPage>
  );
}
