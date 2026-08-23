import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/shell/BrandMark";
import { SiteFooterLinks, TAP_LINK } from "@/components/shell/SiteFooter";

export function PublicPage({
  eyebrow,
  title,
  summary,
  children,
  structuredData,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
  structuredData?: Record<string, unknown>;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/72 backdrop-blur-xl">
        <nav
          aria-label="Public information"
          className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-5"
        >
          <Link to="/" aria-label="OCADE home">
            <BrandMark />
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <Link to="/company" className={TAP_LINK}>
              Company
            </Link>
            <Link to="/products/ocade" className={TAP_LINK}>
              OCADE
            </Link>
            <Link to="/founder/haans-antoni" className={TAP_LINK}>
              Founder
            </Link>
            <Link to="/search" className={TAP_LINK}>
              Search
            </Link>
            <Link to="/blog" className={TAP_LINK}>
              Journal
            </Link>
            <Link to="/privacy" className={TAP_LINK}>
              Privacy
            </Link>
            <Link to="/terms" className={TAP_LINK}>
              Terms
            </Link>
          </div>
        </nav>
      </header>
      <main
        id="main-content"
        className="mx-auto my-8 max-w-3xl rounded-[28px] border border-white/10 bg-background/62 px-5 py-14 shadow-[0_28px_90px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:px-10"
        tabIndex={-1}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">{summary}</p>
        <div className="mt-10 space-y-9 text-sm leading-7">{children}</div>
      </main>
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-3 px-5 py-7 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} CARCC CADANE.</p>
          <SiteFooterLinks />
          <div className="flex flex-wrap gap-4">
            <Link to="/data-rights" className={TAP_LINK}>
              Data rights
            </Link>
            <Link to="/auth" className={TAP_LINK}>
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PublicSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/7 bg-white/[0.018] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

export function DraftNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 p-4 text-[color:var(--state-warning)]">
      <strong>Pre-launch draft — legal review required.</strong>{" "}
      {children ?? "This text is not final legal advice and must be approved before public launch."}
    </div>
  );
}
