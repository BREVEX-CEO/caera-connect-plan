import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Search, X } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { FAQ_GROUPS, filterFaqGroups, type Faq } from "@/lib/public-faq";

/**
 * Public FAQ.
 *
 * Answers only describe behaviour that exists today. Where a capability is
 * still provider- or platform-dependent, the answer says so rather than
 * implying it already works.
 */
export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — CARCC CADANE" },
      {
        name: "description",
        content:
          "Answers about accounts, cross-device sync, billing, privacy modes and account deletion in CARCC CADANE.",
      },
      { property: "og:title", content: "FAQ — CARCC CADANE" },
      {
        property: "og:description",
        content: "Common questions about accounts, sync, billing and privacy in CARCC CADANE.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_GROUPS.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    ),
  };

  return (
    <PublicPage
      eyebrow="Help centre"
      title="Frequently asked questions"
      summary="Short answers about accounts, syncing between devices, billing and how your data is handled. If something here does not cover your case, the support form reaches a person."
      structuredData={structuredData}
    >
      <FaqDirectory />

      <section className="rounded-2xl border border-white/7 bg-white/[0.018] p-5">
        <h2 className="text-lg font-semibold tracking-tight">Still stuck?</h2>
        <p className="mt-2 text-muted-foreground">
          Use the contact form. It reports whether your message was accepted instead of promising
          delivery before the support service confirms it.
        </p>
        <Link
          to="/support"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Contact support
        </Link>
      </section>
    </PublicPage>
  );
}

function topicId(title: string): string {
  return `faq-${title
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

export function FaqDirectory() {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => filterFaqGroups(FAQ_GROUPS, query), [query]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/7 bg-white/[0.018] p-4 sm:p-5">
        <label htmlFor="faq-search" className="text-sm font-medium text-foreground">
          Search questions and answers
        </label>
        <div className="relative mt-2">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “offline”, “sign in” or “payment”"
            className="h-11 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-10 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear FAQ search"
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <nav aria-label="FAQ topics" className="mt-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Browse by topic
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {groups.map((group) => (
              <a
                key={group.title}
                href={`#${topicId(group.title)}`}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {group.title} ({group.items.length})
              </a>
            ))}
          </div>
        </nav>
      </section>

      {groups.length === 0 ? (
        <section role="status" className="rounded-2xl border border-white/7 p-6 text-center">
          <h2 className="font-semibold text-foreground">No matching questions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a shorter term or clear the search to browse every topic.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-4 rounded-md border border-white/10 px-3 py-2 text-sm text-foreground hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Show all questions
          </button>
        </section>
      ) : (
        groups.map((group) => {
          const id = topicId(group.title);
          return (
            <section
              key={group.title}
              id={id}
              className="scroll-mt-24"
              aria-labelledby={`${id}-title`}
            >
              <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight">
                {group.title}
              </h2>
              <div className="mt-3 divide-y divide-white/7 overflow-hidden rounded-2xl border border-white/7 bg-white/[0.018]">
                {group.items.map((item, index) => (
                  <FaqRow key={item.q} item={item} id={`${id}-question-${index + 1}`} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function FaqRow({ item, id }: { item: Faq; id: string }) {
  const [open, setOpen] = useState(false);
  const answerId = `${id}-answer`;
  return (
    <div id={id} className="scroll-mt-24">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={answerId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-[14px] font-medium text-foreground transition-colors hover:bg-white/[0.03]"
        >
          <span>{item.q}</span>
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h3>
      {open ? (
        <p id={answerId} className="px-4 pb-4 text-muted-foreground">
          {item.a}
        </p>
      ) : null}
    </div>
  );
}
