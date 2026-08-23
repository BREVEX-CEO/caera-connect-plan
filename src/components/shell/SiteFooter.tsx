import { Link } from "@tanstack/react-router";

/**
 * One footer link set for every public and marketing surface.
 *
 * The routes here are the public utilities a visitor is entitled to reach from
 * anywhere: search, answers, the rules, the data promise and a human. Support
 * signs a visitor in first because a ticket without an account has nowhere to
 * go back to.
 */
/**
 * Footer links are small TEXT and must not be small TARGETS.
 *
 * At 11-12px these anchors were 14-20 CSS pixels tall, which is comfortable
 * with a mouse and a coin toss with a thumb; WCAG 2.5.8 puts the floor at 24.
 * The padding grows the hit area without growing the type, so the footer still
 * reads as a footer. Measured on every route at phone width by
 * scripts/e2e/route-qa.mjs, which is what found this.
 */
export const TAP_LINK =
  "inline-flex min-h-[24px] items-center px-1 py-1 transition-colors hover:text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The links themselves live in ONE place.
 *
 * There were three hand-rolled copies of this set — here, in the root 404, and
 * on the landing page — which is why the tap-target problem had to be found
 * three times and would have had to be fixed three times.
 */
const FOOTER_LINKS = [
  { to: "/search", label: "Search" },
  { to: "/blog", label: "Journal" },
  { to: "/careers", label: "Careers" },
  { to: "/compare", label: "Compare" },
  { to: "/team", label: "Team" },
  { to: "/press", label: "Press" },
  { to: "/status", label: "Status" },
  { to: "/faq", label: "FAQ" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/settings/support", label: "Support" },
] as const;

export function SiteFooterLinks({
  className = "",
  extra = [],
}: {
  className?: string;
  /** Links a particular surface adds, e.g. Company and Sign in on the landing page. */
  extra?: readonly { to: string; label: string }[];
}) {
  const links = [...extra, ...FOOTER_LINKS];
  return (
    <div className={`-mx-1 flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      {links.map((link) => (
        <Link key={link.to} to={link.to} className={TAP_LINK}>
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="relative z-10 border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} CARCC CADANE. Original work.</p>
        <div className="flex flex-wrap items-center gap-4">
          {children}
          <SiteFooterLinks />
        </div>
      </div>
    </footer>
  );
}
