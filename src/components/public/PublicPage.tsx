import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
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
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}

      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.14),rgba(104,66,139,0.10)_28%,rgba(0,0,0,0)_70%)] blur-2xl" />
        <div className="absolute -left-40 top-[18rem] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(116,73,156,0.12),transparent_68%)] blur-3xl" />
        <div className="absolute -right-48 top-[38rem] h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(174,132,52,0.09),transparent_66%)] blur-3xl" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:54px_54px] [mask-image:linear-gradient(to_bottom,black,transparent_76%)]" />
      </div>

      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-background/70 backdrop-blur-2xl">
        <nav
          aria-label="Public information"
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4"
        >
          <Link
            to="/"
            aria-label="OCADE home"
            className="rounded-full transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none"
          >
            <BrandMark />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
            <Link to="/about" className={TAP_LINK}>About</Link>
            <Link to="/company" className={TAP_LINK}>Company</Link>
            <Link to="/products/ocade" className={TAP_LINK}>OCADE</Link>
            <Link to="/founder/haans-antoni" className={TAP_LINK}>Founder</Link>
            <Link to="/blog" className={TAP_LINK}>Journal</Link>
            <Link to="/support" className={TAP_LINK}>Contact</Link>
            <Link to="/privacy" className={TAP_LINK}>Privacy</Link>
            <Link to="/terms" className={TAP_LINK}>Terms</Link>
          </div>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="relative z-10 focus:outline-none">
        <section className="mx-auto max-w-6xl px-5 pb-6 pt-14 sm:pt-20">
          <div className="relative isolate overflow-hidden rounded-[34px] border border-white/[0.09] bg-black/25 px-6 py-12 shadow-[0_35px_120px_rgba(0,0,0,0.48)] backdrop-blur-2xl sm:px-10 sm:py-16 lg:px-14">
            <div
              aria-hidden
              className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/[0.08] bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.18),rgba(98,57,132,0.10)_30%,transparent_68%)] shadow-[inset_-30px_-30px_70px_rgba(0,0,0,0.65),0_30px_90px_rgba(0,0,0,0.45)] [transform:rotateX(58deg)_rotateZ(-24deg)] motion-safe:animate-[spin_36s_linear_infinite] motion-reduce:animate-none"
            />
            <div
              aria-hidden
              className="absolute -bottom-20 right-[22%] h-40 w-40 rounded-full border border-white/[0.06] bg-[radial-gradient(circle_at_30%_25%,rgba(213,178,93,0.18),rgba(83,47,112,0.07)_42%,transparent_72%)] blur-[1px] [transform:translateZ(60px)]"
            />
            <div className="relative max-w-4xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/90">{eyebrow}</p>
              <h1 className="mt-5 max-w-4xl text-balance text-4xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
                {title}
              </h1>
              <p className="mt-7 max-w-3xl text-pretty text-[15px] leading-7 text-muted-foreground sm:text-base sm:leading-8">
                {summary}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/about"
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-xs font-medium text-foreground transition hover:border-primary/35 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  About CARCC CADANE <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
                <Link
                  to="/support"
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.025] px-4 text-xs font-medium text-muted-foreground transition hover:border-primary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Contact & enquiries <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-5 pb-20 pt-5">
          <div className="space-y-7 text-sm leading-7 sm:text-[15px] sm:leading-8">{children}</div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/[0.07] bg-black/15 backdrop-blur-xl">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-9 text-xs text-muted-foreground sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="font-medium text-foreground">CARCC CADANE</p>
            <p className="mt-1">OCADE — Command the Next Era.</p>
            <p className="mt-2">© {new Date().getFullYear()} CARCC CADANE.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
            <SiteFooterLinks />
            <Link to="/about" className={TAP_LINK}>About</Link>
            <Link to="/support" className={TAP_LINK}>Contact</Link>
            <Link to="/data-rights" className={TAP_LINK}>Data rights</Link>
            <Link to="/auth" className={TAP_LINK}>Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PublicSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="group relative overflow-hidden rounded-[26px] border border-white/[0.075] bg-white/[0.018] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_18px_55px_rgba(0,0,0,0.16)] transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.026] motion-reduce:transform-none sm:p-7">
      <div aria-hidden className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-[22px]">{title}</h2>
      <div className="mt-4 space-y-3.5 text-muted-foreground">{children}</div>
    </section>
  );
}

export function DraftNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 p-4 text-[color:var(--state-warning)]">
      <strong>Draft notice — legal review required.</strong>{" "}
      {children ?? "This text is not final legal advice and must be approved before public launch."}
    </div>
  );
}
