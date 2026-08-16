import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteFooterLinks } from "@/components/shell/SiteFooter";
import { BrandMark } from "./BrandMark";
import { MotionScope } from "@/components/motion/MotionScope";

/**
 * Marketing links, rendered as dimmed labels rather than anchors.
 *
 * None of these `/product/*` pages exist. They are kept as visible-but-inert
 * labels — the `title` says "Ships next" — because that is what they are. The
 * three retired products are dropped: a label promising a product page for
 * something that is not being built is a promise, not a placeholder.
 */
const marketingNav = [{ to: "/product/ocade", label: "OCADE" }];

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 shadow-[0_14px_45px_rgba(0,0,0,0.2)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" aria-label="CAERA CADANE home">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {marketingNav.map((n) => (
              <span
                key={n.to}
                className="text-sm text-muted-foreground opacity-60"
                title="Ships next"
              >
                {n.label}
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="ocade-scene focus:outline-none">
        {/* Scroll motion for every marketing route, including ones added
            later. Falls back to plain visible content — see MotionScope.
            `ocade-scene` is the shared vanishing point — see WorkspaceShell. */}
        <MotionScope>{children}</MotionScope>
      </main>
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <BrandMark />
          <p>© {new Date().getFullYear()} CAERA CADANE. Original work.</p>
          <SiteFooterLinks className="text-xs" />
        </div>
      </footer>
    </div>
  );
}
