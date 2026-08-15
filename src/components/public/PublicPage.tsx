import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

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
      <header className="border-b border-border/60">
        <nav
          aria-label="Public information"
          className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-5"
        >
          <Link to="/" className="font-semibold tracking-[0.16em]">
            CAERA CADANE
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <Link to="/company" className="hover:text-foreground">
              Company
            </Link>
            <Link to="/products/ocade" className="hover:text-foreground">
              OCADE
            </Link>
            <Link to="/founder/haans-antoni" className="hover:text-foreground">
              Founder
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </div>
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-5 py-14" tabIndex={-1}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">{summary}</p>
        <div className="mt-10 space-y-9 text-sm leading-7">{children}</div>
      </main>
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-3 px-5 py-7 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Haans Antoni. CAERA CADANE brand.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/data-rights" className="hover:text-foreground">
              Data rights
            </Link>
            <Link to="/auth" className="hover:text-foreground">
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
    <section>
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
