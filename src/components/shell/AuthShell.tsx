import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "./BrandMark";

/**
 * The way in: one centred column on a plain field.
 *
 * The previous version was a full-viewport composition with two radial washes,
 * a column anchored to one edge and clamp-based fluid spacing throughout. This
 * is the first screen a person sees, and `docs/PRD.md` asks for
 * generous empty space rather than composition — so the page is the same
 * near-black as the product, with one small card and the legal links under it.
 */
export function AuthShell({
  children,
  title,
  subtitle,
  footer,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center px-5">
        <Link to="/" aria-label="OCADE home" className="rounded-md">
          <BrandMark showWordmark />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
          ) : null}
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-6 text-[13px] text-muted-foreground">{footer}</div> : null}
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-4 border-t border-border/60 px-5 py-4 text-[13px] text-muted-foreground">
        <Link
          to="/terms"
          className="inline-flex min-h-6 items-center transition-colors hover:text-foreground"
        >
          Terms
        </Link>
        <Link
          to="/privacy"
          className="inline-flex min-h-6 items-center transition-colors hover:text-foreground"
        >
          Privacy
        </Link>
        <Link
          to="/help"
          className="inline-flex min-h-6 items-center transition-colors hover:text-foreground"
        >
          Help
        </Link>
      </footer>
    </div>
  );
}
