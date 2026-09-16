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
  children,
  /** Long legal and help pages get the control; About does not need it. */
  backToTop = false,
  /** Pricing lays three cards side by side and needs the room. */
  wide = false,
}: {
  title: string;
  intro?: string;
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

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className={`mx-auto flex h-14 ${column} items-center justify-between px-5`}>
          <Link to="/" aria-label="OCADE home" className="rounded-md">
            <BrandMark showWordmark />
          </Link>
          <nav aria-label="Public pages" className="flex items-center gap-1">
            {PUBLIC_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
        {intro ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{intro}</p> : null}
        <div className="mt-8">{children}</div>
      </main>

      <footer className="border-t border-border/60">
        <div
          className={`mx-auto flex ${column} flex-wrap items-center justify-between gap-3 px-5 py-6 text-[13px] text-muted-foreground`}
        >
          <span>OCADE by CARCC CADANE</span>
          <Link to="/" className="transition-colors hover:text-foreground">
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
export function PublicSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}
