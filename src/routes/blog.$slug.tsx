import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";
import { PrelaunchSubscription } from "@/components/public/PrelaunchSubscription";
import { findPublicArticle, PUBLIC_ARTICLES } from "@/lib/public-content";
import { useFormatters } from "@/lib/locale/use-formatters";

export const Route = createFileRoute("/blog/$slug")({
  component: ArticlePage,
});

function ArticlePage() {
  const formatters = useFormatters();
  const { slug } = Route.useParams();
  const article = findPublicArticle(slug);
  if (!article)
    return (
      <PublicPage
        eyebrow="Journal"
        title="Post not found"
        summary="That OCADE journal entry is not published."
      >
        <Link to="/blog" className="underline">
          Return to the journal
        </Link>
      </PublicPage>
    );
  const related = PUBLIC_ARTICLES.filter((item) => item.slug !== article.slug);
  return (
    <PublicPage
      eyebrow="OCADE journal"
      title={article.title}
      summary={article.subtitle}
      structuredData={{
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: article.title,
        description: article.description,
        author: { "@type": "Person", name: article.author },
        datePublished: article.published,
        image: article.thumbnail,
      }}
    >
      <img
        src={article.thumbnail}
        alt="OCADE by CARCC CADANE"
        width={2172}
        height={724}
        className="aspect-[3/1] w-full rounded-2xl object-cover"
      />
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>By {article.author}</span>
        <time dateTime={article.published}>
          {formatters.date(new Date(`${article.published}T00:00:00Z`), {
            dateStyle: "long",
            timeZone: "UTC",
          })}
        </time>
        {article.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-border/70 px-2 py-0.5">
            {tag}
          </span>
        ))}
      </div>
      <article className="space-y-7">
        {article.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
      <section aria-labelledby="share-title" className="rounded-2xl border border-white/7 p-5">
        <h2 id="share-title" className="font-semibold">
          Share this article
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use your browser share menu or copy this page address. OCADE does not post to a social
          account for you.
        </p>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(window.location.href)}
          className="mt-3 min-h-9 rounded-md border border-border/70 px-3 text-xs"
        >
          Copy article link
        </button>
      </section>
      <section className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-5">
        <h2 className="text-lg font-semibold">Try the product boundary yourself</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A free account uses a real local engine when this browser can run one and names the
          failure when it cannot.
        </p>
        <Link
          to="/auth"
          className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Create a free account
        </Link>
      </section>
      <section aria-labelledby="related-title">
        <h2 id="related-title" className="text-xl font-semibold">
          Related articles
        </h2>
        <div className="mt-3 grid gap-3">
          {related.map((item) => (
            <Link
              key={item.slug}
              to="/blog/$slug"
              params={{ slug: item.slug }}
              className="rounded-xl border border-white/7 p-4 hover:border-primary/35"
            >
              <span className="font-medium">{item.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
            </Link>
          ))}
        </div>
      </section>
      <PrelaunchSubscription />
      <section
        aria-labelledby="comments-title"
        className="rounded-2xl border border-dashed border-border/70 p-5"
      >
        <h2 id="comments-title" className="text-lg font-semibold">
          Comments
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Public comments are closed during pre-launch because account identity, moderation and the
          correct production data project are not yet verified. No comment count is claimed.
        </p>
      </section>
    </PublicPage>
  );
}
