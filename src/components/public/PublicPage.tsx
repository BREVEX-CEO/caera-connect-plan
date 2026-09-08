import { Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { SiteFooterLinks, TAP_LINK } from "@/components/shell/SiteFooter";

/*
 * NO THIRD PARTY BEHIND THE PUBLIC PAGES, AND THE SECOND TIME THAT WAS TRUE.
 *
 * Every public page used to append a <script> tag for hls.js from a public CDN.
 * The application's own Content-Security-Policy allows scripts from this origin
 * and nowhere else, so the browser refused the request — on every page, for
 * every visitor, in production. The route sweep is what finally said so out
 * loud: sixty-seven pages, each with one failing request to a host we do not
 * permit. It was removed rather than allowed.
 *
 * The <video> it fed was the same story one layer down, and it took a browser
 * journey to find. The element pulled a muted background clip from a media host
 * that this application's policy does not permit either, so from the moment the
 * launch gate opened it loaded nothing and logged
 *
 *   Refused to load media from 'https://stream.mux.com/…' because it violates
 *   the following Content Security Policy directive: "media-src …"
 *
 * on every public page, on every visit. No launched visitor has ever seen it.
 *
 * ALLOWING THE HOST WAS TRIED FIRST, AND MADE THINGS WORSE. With the policy
 * widened the request actually left the browser, and on any network that cannot
 * reach that host — including the one this repository's audits run on — twenty
 * public routes began failing the "no failing request outside loopback" check
 * instead. That is the real cost stated plainly: a decorative, aria-hidden layer
 * at 24% opacity, sitting behind four gradients, was making every public page's
 * health depend on a third party, and buying nothing anybody can see.
 *
 * So it is gone, and the backdrop is what it has always actually been: the
 * gradients, the drifting glows, the grid and the pointer-tracked light below.
 * Restoring a video here needs a self-hosted asset and a deliberate policy
 * decision, not a re-added <video> tag.
 */

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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-public-tilt]"));
    const disposers: Array<() => void> = [];

    for (const card of cards) {
      const onMove = (event: PointerEvent) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        const rx = (0.5 - py) * 2.8;
        const ry = (px - 0.5) * 3.6;
        card.style.transform = `perspective(1100px) translateY(-5px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        card.style.setProperty("--tilt-x", `${px * 100}%`);
        card.style.setProperty("--tilt-y", `${py * 100}%`);
      };
      const onLeave = () => {
        card.style.transform = "perspective(1100px) translateY(0) rotateX(0deg) rotateY(0deg)";
      };
      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);
      disposers.push(() => {
        card.removeEventListener("pointermove", onMove);
        card.removeEventListener("pointerleave", onLeave);
      });
    }

    const onPointer = (event: PointerEvent) => {
      root.style.setProperty("--mouse-x", `${event.clientX}px`);
      root.style.setProperty("--mouse-y", `${event.clientY}px`);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      for (const dispose of disposers) dispose();
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative min-h-screen overflow-x-hidden bg-[#050505] text-[#f5f5f5] [--mouse-x:50vw] [--mouse-y:25vh]"
    >
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}

      <style>{`
        @keyframes public-scroll-line { 0% { transform: translateY(-110%); } 100% { transform: translateY(210%); } }
        @keyframes public-float-a { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(3vw,-2vh,0) scale(1.08); } }
        @keyframes public-float-b { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(-2vw,3vh,0); } }
        @keyframes public-gradient { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        [data-public-tilt] { transform-style: preserve-3d; transition: transform .22s ease, border-color .25s ease, background-color .25s ease, box-shadow .25s ease; }
        [data-public-tilt]::after { content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit; opacity:0; background:radial-gradient(420px circle at var(--tilt-x,50%) var(--tilt-y,50%),rgba(255, 255, 255,.105),transparent 42%); transition:opacity .25s ease; }
        [data-public-tilt]:hover::after { opacity:1; }
        @media (prefers-reduced-motion: reduce) { [data-public-tilt] { transition:none; } }
      `}</style>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#050505]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5, 5, 5,.30),rgba(5, 5, 5,.82)_64%,#050505_96%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--mouse-x)_var(--mouse-y),rgba(95, 95, 95,.14),transparent_22rem)]" />
        <div className="absolute -left-32 top-[20vh] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(49, 49, 49,.22),transparent_66%)] blur-3xl motion-safe:animate-[public-float-a_14s_ease-in-out_infinite]" />
        <div className="absolute -right-44 top-[52vh] h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(150, 150, 150,.09),transparent_65%)] blur-3xl motion-safe:animate-[public-float-b_17s_ease-in-out_infinite]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255, 255, 255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255, 255, 255,.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
      </div>

      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-5">
        <nav
          aria-label="Public information"
          className="mx-auto flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-[#0b0b0b]/76 p-1.5 shadow-[0_18px_65px_rgba(0, 0, 0,.42),inset_0_1px_0_rgba(255, 255, 255,.055)] backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Link
            to="/"
            aria-label="OCADE home"
            className="group mr-1 flex shrink-0 items-center gap-2 rounded-full px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-white/15 bg-black shadow-[0_0_26px_rgba(72, 72, 72,.26)] transition-transform duration-300 group-hover:scale-110">
              <span className="absolute inset-[-1px] rounded-full bg-[conic-gradient(from_215deg,#d6d6d6,#383838,#a4a4a4,#d6d6d6)] opacity-70" />
              <span className="relative grid h-[32px] w-[32px] place-items-center overflow-hidden rounded-full bg-black">
                <img
                  src="/brand/ocade-carcc-mark.png"
                  alt=""
                  className="h-full w-full object-contain"
                />
              </span>
            </span>
            <span className="hidden pr-1 text-left sm:block">
              <span className="block text-[10px] font-semibold tracking-[0.22em] text-white">
                OCADE
              </span>
              <span className="block text-[8px] tracking-[0.16em] text-white/45">CARCC CADANE</span>
            </span>
          </Link>

          <div className="mx-1 hidden h-5 w-px shrink-0 bg-white/10 sm:block" />
          <NavLink to="/" label="Home" />
          <NavLink to="/about" label="About" />
          <NavLink to="/products/ocade" label="OCADE" />
          <NavLink to="/company" label="Company" />
          <NavLink to="/founder/haans-antoni" label="Founder" />
          <NavLink to="/support" label="Contact" />
          <NavLink to="/privacy" label="Privacy" />
          <NavLink to="/terms" label="Terms" />
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="relative z-10 focus:outline-none">
        <section className="relative flex min-h-[78svh] items-center justify-center px-5 pb-16 pt-28 text-center sm:min-h-[84svh] sm:pt-32">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto mb-7 flex w-fit items-center gap-3 rounded-full border border-white/10 bg-black/28 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55 backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a9a9a9] shadow-[0_0_15px_rgba(169, 169, 169,.75)]" />
              {eyebrow}
            </div>

            <h1 className="mx-auto max-w-5xl text-balance text-[clamp(3.3rem,10vw,8.5rem)] font-semibold leading-[0.86] tracking-[-0.065em] text-white drop-shadow-[0_28px_70px_rgba(0, 0, 0,.65)]">
              {title}
            </h1>

            <p className="mx-auto mt-8 max-w-3xl text-pretty text-[15px] leading-7 text-white/58 sm:text-[17px] sm:leading-8">
              {summary}
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/about"
                className="group relative inline-flex min-h-11 items-center justify-center overflow-hidden rounded-full bg-white px-6 text-[13px] font-medium text-black transition-transform duration-300 hover:scale-[1.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transform-none"
              >
                <span className="relative z-10 flex items-center gap-2">
                  About CARCC CADANE <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
              <Link
                to="/support"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/12 bg-black/30 px-6 text-[13px] font-medium text-white/82 backdrop-blur-xl transition duration-300 hover:border-white/24 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
              >
                Contact & enquiries <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>

          <div
            aria-hidden
            className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-white/35"
          >
            Scroll
            <span className="relative h-9 w-px overflow-hidden bg-white/12">
              <span className="absolute inset-x-0 h-4 bg-gradient-to-b from-transparent via-white/80 to-transparent motion-safe:animate-[public-scroll-line_1.6s_ease-in-out_infinite]" />
            </span>
          </div>
        </section>

        <section className="relative mx-auto max-w-5xl px-5 pb-24 pt-6 sm:pb-32">
          <div className="mb-8 flex items-end justify-between gap-6 border-b border-white/[0.08] pb-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/36">
                Official information
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
                Read the details
              </h2>
            </div>
            <span className="hidden max-w-xs text-right text-xs leading-5 text-white/34 sm:block">
              Clear, current documentation for OCADE and CARCC CADANE.
            </span>
          </div>
          {/*
            A MEASURED LINE LENGTH, NOT A TASTE.

            At 1440 and above this column is 984px wide, and a paragraph set in
            it ran to a hundred and sixty-four characters. Past roughly ninety
            the eye stops reliably finding the start of the next line on the
            return sweep, so the reader loses their place — on the widest and
            most comfortable screens, which is the part that makes it a defect
            rather than a preference.

            `max-w-[70ch]` on the PARAGRAPHS and list items rather than on the
            column: cards, grids, tables and the plan comparison keep the full
            width they were designed for, and only running text is measured.
            `ch` is resolved against each paragraph's own font size, so an
            11px footnote and a 15px lead both come out at about seventy
            characters instead of one bound serving neither.

            A deliberately centred block (`/faq` has one) adds `[&_p]:mx-auto`
            of its own; a max-width with no auto margin would quietly turn its
            centred prose left-aligned.
          */}
          <div className="space-y-5 text-sm leading-7 [&_li]:max-w-[70ch] [&_p]:max-w-[70ch] sm:text-[15px] sm:leading-8">
            {children}
          </div>
        </section>
      </main>

      <footer className="relative z-10 overflow-hidden border-t border-white/[0.075] bg-black/35 px-5 py-12 backdrop-blur-xl">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(46, 46, 46,.12))]"
        />
        <div className="relative mx-auto grid max-w-6xl gap-8 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/brand/ocade-carcc-mark.png"
                alt=""
                className="h-10 w-10 rounded-full object-contain"
              />
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-white">OCADE</p>
                <p className="text-[10px] tracking-[0.17em] text-white/38">BY CARCC CADANE</p>
              </div>
            </div>
            <p className="mt-5 max-w-md text-xs leading-6 text-white/42">
              Command the Next Era. Private intelligence, user control and permissioned action.
            </p>
            <p className="mt-4 text-[11px] text-white/30">
              © {new Date().getFullYear()} CARCC CADANE.
            </p>
          </div>
          <div className="flex max-w-md flex-wrap gap-x-4 gap-y-3 text-xs text-white/48 sm:justify-end">
            <SiteFooterLinks />
            <Link to="/about" className={TAP_LINK}>
              About
            </Link>
            <Link to="/support" className={TAP_LINK}>
              Contact
            </Link>
            <Link to="/privacy" className={TAP_LINK}>
              Privacy
            </Link>
            <Link to="/terms" className={TAP_LINK}>
              Terms
            </Link>
            <Link to="/data-rights" className={TAP_LINK}>
              Data rights
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({
  to,
  label,
}: {
  to:
    | "/"
    | "/about"
    | "/products/ocade"
    | "/company"
    | "/founder/haans-antoni"
    | "/support"
    | "/privacy"
    | "/terms";
  label: string;
}) {
  return (
    <Link
      to={to}
      className="shrink-0 rounded-full px-3 py-2 text-[11px] font-medium text-white/52 transition-colors duration-200 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 sm:px-3.5 sm:text-[12px]"
    >
      {label}
    </Link>
  );
}

export function PublicSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      data-public-tilt
      className="group relative overflow-hidden rounded-[28px] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(19, 19, 19,.80),rgba(8, 8, 8,.72))] p-5 shadow-[0_28px_90px_rgba(0, 0, 0,.22),inset_0_1px_0_rgba(255, 255, 255,.045)] backdrop-blur-2xl hover:border-white/[0.15] hover:shadow-[0_32px_110px_rgba(0, 0, 0,.32),0_0_50px_rgba(57, 57, 57,.10)] sm:p-7"
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[#a9a9a9]/50 to-transparent opacity-35 transition-opacity group-hover:opacity-90"
      />
      <div
        aria-hidden
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(72, 72, 72,.16),transparent_70%)] blur-2xl"
      />
      <h2 className="relative z-10 text-xl font-semibold tracking-[-0.025em] text-white sm:text-[23px]">
        {title}
      </h2>
      <div className="relative z-10 mt-4 space-y-3.5 text-white/55 marker:text-white/34 [&_a]:text-white/82 [&_a]:underline-offset-4 [&_a:hover]:text-white [&_strong]:text-white/85">
        {children}
      </div>
    </section>
  );
}

/**
 * A note on a public page about what is and is not available yet.
 *
 * WHAT THIS USED TO BE. `DraftNotice`, headed "Draft notice — legal review
 * required", telling visitors that the text they were reading "must be
 * approved before public launch". The pages below it went on to explain that
 * prices were "founder-approved" and that an installer might trigger a
 * SmartScreen warning. That is a team's internal checklist printed on the
 * storefront: it tells a customer nothing they can act on and quite a lot they
 * should never have to think about.
 *
 * It also painted itself in Tailwind's amber, the one colour family the palette
 * does not contain, so every public page carried an off-brand block. It is gold
 * now, which is the palette's own attention colour.
 *
 * What survives is the honest part: when something is not available yet, say
 * so, in a sentence about the reader rather than about the team.
 */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 text-foreground/80 backdrop-blur-xl">
      {children}
    </div>
  );
}
