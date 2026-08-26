import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "./BrandMark";

/**
 * The way in.
 *
 * WHAT THIS TOOK FROM THE REFERENCE, AND WHAT IT DELIBERATELY DID NOT
 * -------------------------------------------------------------------
 * The auth reference is a full-viewport dark composition: enormous negative
 * space, a single column of content pinned to one side, sharp rectangles
 * instead of pills, a display weight for the name and a mono face for the
 * small technical line above it, and a legal footer sitting on a hairline at
 * the bottom of the screen. That LANGUAGE is what is used here.
 *
 * Its brand, its copy, its media and its links are not. This is OCADE's sign-in
 * page; borrowing another product's wording would be both wrong and useless.
 *
 * WHY THE FORM SITS TO ONE SIDE ON A LARGE SCREEN
 * -----------------------------------------------
 * A centred card on a 27-inch display is a small box floating in a large void,
 * and the void reads as unfinished. Anchoring the column to one edge makes the
 * space deliberate — it is composition rather than absence — while on a phone
 * the same column simply fills the screen, which is why the layout is one
 * column that moves rather than two designs.
 *
 * WHY THERE IS NO BACKGROUND VIDEO
 * --------------------------------
 * The reference carries a full-bleed cinematic loop. OCADE is offline-first and
 * this is the first screen a person ever sees: a video is megabytes fetched
 * before anybody has signed in, on a connection that may be the reason they are
 * signing in from a train. The composition holds without it.
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
    <div className="relative min-h-screen bg-background">
      {/*
        The field. Two very low-chroma washes rather than a flat black, so the
        page has depth without becoming a gradient anybody would notice. Fixed,
        so it does not move when a long form scrolls on a phone.
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_50%_at_15%_-10%,oklch(0.5_0.1_315/14%),transparent_60%),radial-gradient(50%_40%_at_100%_100%,oklch(0.68_0.11_78/8%),transparent_65%)]"
      />

      <div className="relative grid min-h-screen grid-rows-[auto_1fr_auto]">
        <header className="flex items-center justify-between px-[clamp(1.25rem,5vw,4.5rem)] py-[clamp(1.25rem,2.4vw,2rem)]">
          <Link
            to="/"
            aria-label="CARCC CADANE home"
            className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandMark />
          </Link>
          {/*
            The tappable area is larger than the lettering. At 11px this link
            was 17 pixels tall, which is below the 24-pixel minimum a thumb can
            reliably hit — the route sweep flagged it on every page that uses
            this shell. `-mr-2` keeps the added padding from pushing the text
            off its optical alignment with the mark opposite.
          */}
          <Link
            to="/support"
            className="-mr-2 inline-flex min-h-11 items-center rounded-sm px-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Support
          </Link>
        </header>

        {/*
          A main landmark, so assistive tech can jump straight to the form.
          No skip link: there is no navigation ahead of the content to skip.
        */}
        <main
          id="main-content"
          className="flex min-h-0 items-center justify-center overflow-y-auto px-[clamp(1.25rem,5vw,4.5rem)] py-6 lg:justify-end"
        >
          <div className="w-full max-w-[26rem] lg:max-w-[30rem]">
            {/*
              The eyebrow, in mono. Small technical type above a large soft
              display weight is the reference's whole typographic idea, and it
              does real work here: it says which product this account is for
              before the person reads the heading.
            */}
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              OCADE
            </p>
            <h1 className="mt-[clamp(1rem,2vw,1.75rem)] text-[clamp(2rem,4.2vw,3.25rem)] font-extralight leading-[1.05] tracking-[0.01em] text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 max-w-[24rem] text-sm leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            ) : null}

            {/*
              No card. The reference composes on the page itself, and a panel
              here would put a box inside a box — the negative space around the
              column is already the container.
            */}
            <div className="mt-[clamp(1.75rem,3.5vw,2.75rem)]">{children}</div>
          </div>
        </main>

        {footer ? (
          <footer className="border-t border-border/60 px-[clamp(1.25rem,5vw,4.5rem)] py-[clamp(1rem,1.7vw,1.6rem)] pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs leading-relaxed text-muted-foreground">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
