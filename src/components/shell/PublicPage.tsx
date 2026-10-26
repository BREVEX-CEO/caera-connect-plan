/**
 * The frame for the four pages that exist outside the product: About, Help,
 * Terms and Privacy.
 *
 * It is deliberately not the app shell. These pages are read rather than
 * worked in, they must render for somebody with no account, and they must not
 * pull the workspace's session and model bootstrap into a document a search
 * crawler fetches.
 */
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUp } from "lucide-react";
import { BrandMark } from "./BrandMark";

const PUBLIC_LINKS = [
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/help", label: "Help" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
] as const;

export function PublicPage({
  title,
  intro,
  updated,
  children,
  /** Long legal and help pages get the control; About does not need it. */
  backToTop = false,
  /** Pricing lays three cards side by side and needs the room. */
  wide = false,
}: {
  title: string;
  intro?: string;
  /** When a legal document took effect and was last changed. */
  updated?: string;
  children: ReactNode;
  backToTop?: boolean;
  wide?: boolean;
}) {
  const column = wide ? "max-w-5xl" : "max-w-3xl";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#content" className="skip-link">
        Skip to content
      </a>

      {/*
        FIVE LINKS AND A WORDMARK DO NOT FIT ON A PHONE IN ONE ROW.
        At 375 px the document scrolled 425 px wide against a 360 px viewport and
        Privacy sat off the right-hand edge — reachable only by scrolling the page
        sideways, which nobody thinks to try on a page of text. The row becomes a
        column below `sm` and the links wrap, so every destination is on screen
        whatever the width; the desktop header is unchanged. The taller phone
        padding is the touch target the 13 px row did not have.
      */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div
          className={`mx-auto flex ${column} flex-col gap-1 px-5 py-2 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:py-0`}
        >
          <Link to="/" aria-label="OCADE home" className="rounded-md">
            <BrandMark showWordmark />
          </Link>
          <nav
            aria-label="Public pages"
            className="-mx-2.5 flex flex-wrap items-center gap-x-1 sm:mx-0 sm:flex-nowrap"
          >
            {PUBLIC_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-md px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:py-1.5"
                activeProps={{ className: "text-foreground" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main id="content" className={`mx-auto ${column} px-5 py-12`}>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {updated ? <p className="mt-2 text-xs text-muted-foreground">{updated}</p> : null}
        {intro ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{intro}</p> : null}
        <div className="mt-8">{children}</div>
      </main>

      <footer className="border-t border-border/60">
        <div
          className={`mx-auto flex ${column} flex-wrap items-center justify-between gap-3 px-5 py-6 text-[13px] text-muted-foreground`}
        >
          <span>OCADE by CARCC</span>
          <Link
            to="/"
            className="inline-flex min-h-6 items-center transition-colors hover:text-foreground"
          >
            Open Chat
          </Link>
        </div>
      </footer>

      {backToTop ? <BackToTop /> : null}
    </div>
  );
}

/** Appears only once there is enough page behind you to make it useful. */
function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="glass fixed bottom-6 right-6 grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors hover:bg-accent"
      aria-label="Back to top"
    >
      <ArrowUp className="h-4 w-4" aria-hidden />
    </button>
  );
}

/** One titled block of a long legal or help document. */
export function PublicSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-8 scroll-mt-20">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}
