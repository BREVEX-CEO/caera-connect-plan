import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search as SearchIcon, X } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import {
  PUBLIC_SEARCH_INDEX,
  searchPublicPages,
  type PublicSearchCategory,
  type PublicSearchSort,
} from "@/lib/public-search";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — CARCC CADANE" },
      {
        name: "description",
        content: "Search official CARCC CADANE and OCADE product, help and legal information.",
      },
    ],
  }),
  component: PublicSearchPage,
});

const CATEGORIES: readonly (PublicSearchCategory | "All")[] = [
  "All",
  "Company",
  "Product",
  "Help",
  "Legal",
];

const SUGGESTIONS = ["local AI", "pricing", "privacy", "founder", "account"] as const;

function PublicSearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PublicSearchCategory | "All">("All");
  const [sort, setSort] = useState<PublicSearchSort>("relevance");
  const deferredQuery = useDeferredValue(query);
  const searching = query !== deferredQuery;
  const results = useMemo(
    () => searchPublicPages(deferredQuery, category, sort),
    [deferredQuery, category, sort],
  );

  return (
    <PublicPage
      eyebrow="Official directory"
      title="Search CARCC CADANE"
      summary="Search the current public product, company, help and legal pages. Results come from this verified site index; OCADE does not send these searches to a third party."
    >
      <section className="rounded-2xl border border-white/7 bg-white/[0.018] p-4 sm:p-5">
        <label htmlFor="public-search" className="text-sm font-medium text-foreground">
          Search official pages
        </label>
        <div className="relative mt-2">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="public-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try privacy, pricing or local AI"
            className="min-h-11 w-full rounded-lg border border-border/70 bg-background/70 py-2 pl-10 pr-11 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear public search"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        {!query ? (
          <div className="mt-4" aria-label="Suggested searches">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Suggested searches
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuery(suggestion)}
                  className="min-h-9 rounded-full border border-border/70 px-3 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">
            Category
            <select
              aria-label="Search category"
              value={category}
              onChange={(event) => setCategory(event.target.value as PublicSearchCategory | "All")}
              className="mt-1 min-h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
            >
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Order
            <select
              aria-label="Search result order"
              value={sort}
              onChange={(event) => setSort(event.target.value as PublicSearchSort)}
              className="mt-1 min-h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
            >
              <option value="relevance">Most relevant</option>
              <option value="title">Title A–Z</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-labelledby="search-results-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="search-results-heading" className="text-xl font-semibold tracking-tight">
            Results
          </h2>
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {searching
              ? "Searching official pages…"
              : `${results.length} ${results.length === 1 ? "result" : "results"}`}
          </p>
        </div>

        {results.length ? (
          <ol className="mt-4 space-y-3">
            {results.map((result) => (
              <li key={result.id}>
                <Link
                  to={result.href}
                  className="block rounded-2xl border border-white/7 bg-white/[0.018] p-5 transition hover:border-primary/35 hover:bg-white/[0.035]"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                    {result.category}
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-foreground">
                    <Highlighted text={result.title} query={deferredQuery} />
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    <Highlighted text={result.summary} query={deferredQuery} />
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border/70 p-6 text-center">
            <p className="font-medium text-foreground">No official page matches that search.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clear the category, try fewer words, or contact support if the information should be
              public.
            </p>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Directory coverage: {PUBLIC_SEARCH_INDEX.length} verified public pages. Search text stays in
        this browser.
      </p>
    </PublicPage>
  );
}

function Highlighted({ text, query }: { text: string; query: string }): ReactNode {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return text;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  return text.split(pattern).map((part, index) =>
    terms.some((term) => part.localeCompare(term, undefined, { sensitivity: "accent" }) === 0) ? (
      <mark key={`${part}-${index}`} className="rounded bg-primary/20 px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
