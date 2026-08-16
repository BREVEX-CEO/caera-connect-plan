import { Link } from "@tanstack/react-router";

/**
 * One footer link set for every public and marketing surface.
 *
 * The routes here are the four a visitor is entitled to reach from anywhere:
 * answers (/faq), the rules (/terms), the data promise (/privacy) and a human
 * (/settings/support — the support form, which signs you in first because a
 * ticket without an account has nowhere to go back to).
 */
export function SiteFooterLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-4 ${className}`}>
      <Link to="/faq" className="transition-colors hover:text-foreground">
        FAQ
      </Link>
      <Link to="/terms" className="transition-colors hover:text-foreground">
        Terms
      </Link>
      <Link to="/privacy" className="transition-colors hover:text-foreground">
        Privacy
      </Link>
      <Link to="/settings/support" className="transition-colors hover:text-foreground">
        Support
      </Link>
    </div>
  );
}

export function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="relative z-10 border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} CAERA CADANE. Original work.</p>
        <div className="flex flex-wrap items-center gap-4">
          {children}
          <SiteFooterLinks />
        </div>
      </div>
    </footer>
  );
}
