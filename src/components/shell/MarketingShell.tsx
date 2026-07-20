import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";

const marketingNav = [
  { to: "/product/ocade", label: "OCADE" },
  { to: "/product/ficia", label: "FICIA" },
  { to: "/product/madee", label: "MADEE" },
  { to: "/product/cania", label: "CANIA" },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" aria-label="CAERA CADANE home">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {marketingNav.map((n) => (
              <span key={n.to} className="text-sm text-muted-foreground opacity-60" title="Ships next">
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
      <main>{children}</main>
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <BrandMark />
          <p>© {new Date().getFullYear()} CAERA CADANE. Original work.</p>
        </div>
      </footer>
    </div>
  );
}
