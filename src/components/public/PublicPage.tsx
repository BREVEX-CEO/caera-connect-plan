import { Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { SiteFooterLinks, TAP_LINK } from "@/components/shell/SiteFooter";

const MUX_PLAYBACK_ID = "Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g";
const MUX_HLS = `https://stream.mux.com/${MUX_PLAYBACK_ID}.m3u8`;
const MUX_MP4 = `https://stream.mux.com/${MUX_PLAYBACK_ID}/high.mp4`;
const HLS_SCRIPT = "https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js";

type HlsInstance = {
  loadSource(source: string): void;
  attachMedia(media: HTMLMediaElement): void;
  destroy(): void;
};

type HlsConstructor = {
  new (): HlsInstance;
  isSupported(): boolean;
};

type WindowWithHls = Window & { Hls?: HlsConstructor };

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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: HlsInstance | null = null;
    let cancelled = false;

    const playQuietly = () => {
      void video.play().catch(() => undefined);
    };

    const fallBackToMp4 = () => {
      if (cancelled) return;
      video.src = MUX_MP4;
      playQuietly();
    };

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = MUX_HLS;
      playQuietly();
    } else {
      const startHls = () => {
        const Hls = (window as WindowWithHls).Hls;
        if (!Hls?.isSupported()) {
          fallBackToMp4();
          return;
        }
        hls = new Hls();
        hls.loadSource(MUX_HLS);
        hls.attachMedia(video);
        playQuietly();
      };

      if ((window as WindowWithHls).Hls) {
        startHls();
      } else {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${HLS_SCRIPT}"]`);
        if (existing) {
          existing.addEventListener("load", startHls, { once: true });
          existing.addEventListener("error", fallBackToMp4, { once: true });
        } else {
          const script = document.createElement("script");
          script.src = HLS_SCRIPT;
          script.async = true;
          script.crossOrigin = "anonymous";
          script.addEventListener("load", startHls, { once: true });
          script.addEventListener("error", fallBackToMp4, { once: true });
          document.head.appendChild(script);
        }
      }
    }

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, []);

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
      className="relative min-h-screen overflow-x-hidden bg-[#050505] text-[#f5f5f7] [--mouse-x:50vw] [--mouse-y:25vh]"
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
        [data-public-tilt]::after { content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit; opacity:0; background:radial-gradient(420px circle at var(--tilt-x,50%) var(--tilt-y,50%),rgba(255,255,255,.105),transparent 42%); transition:opacity .25s ease; }
        [data-public-tilt]:hover::after { opacity:1; }
        @media (prefers-reduced-motion: reduce) { [data-public-tilt] { transition:none; } }
      `}</style>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#050505]"
      >
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          tabIndex={-1}
          className="absolute left-1/2 top-1/2 h-full min-h-full w-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover opacity-[0.24] saturate-[0.55] contrast-[1.12] brightness-[0.58]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,.30),rgba(5,5,5,.82)_64%,#050505_96%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--mouse-x)_var(--mouse-y),rgba(121,82,153,.14),transparent_22rem)]" />
        <div className="absolute -left-32 top-[20vh] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(71,38,91,.22),transparent_66%)] blur-3xl motion-safe:animate-[public-float-a_14s_ease-in-out_infinite]" />
        <div className="absolute -right-44 top-[52vh] h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(190,147,58,.09),transparent_65%)] blur-3xl motion-safe:animate-[public-float-b_17s_ease-in-out_infinite]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />
      </div>

      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-5">
        <nav
          aria-label="Public information"
          className="mx-auto flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-[#0b0b0d]/76 p-1.5 shadow-[0_18px_65px_rgba(0,0,0,.42),inset_0_1px_0_rgba(255,255,255,.055)] backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Link
            to="/"
            aria-label="OCADE home"
            className="group mr-1 flex shrink-0 items-center gap-2 rounded-full px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-white/15 bg-black shadow-[0_0_26px_rgba(104,57,132,.26)] transition-transform duration-300 group-hover:scale-110">
              <span className="absolute inset-[-1px] rounded-full bg-[conic-gradient(from_215deg,#d6d6da,#5b286f,#c8a24c,#d6d6da)] opacity-70" />
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
              <span className="h-1.5 w-1.5 rounded-full bg-[#caa84f] shadow-[0_0_15px_rgba(202,168,79,.75)]" />
              {eyebrow}
            </div>

            <h1 className="mx-auto max-w-5xl text-balance text-[clamp(3.3rem,10vw,8.5rem)] font-semibold leading-[0.86] tracking-[-0.065em] text-white drop-shadow-[0_28px_70px_rgba(0,0,0,.65)]">
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
          <div className="space-y-5 text-sm leading-7 sm:text-[15px] sm:leading-8">{children}</div>
        </section>
      </main>

      <footer className="relative z-10 overflow-hidden border-t border-white/[0.075] bg-black/35 px-5 py-12 backdrop-blur-xl">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(69,35,86,.12))]"
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
      className="group relative overflow-hidden rounded-[28px] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(19,18,22,.80),rgba(8,8,10,.72))] p-5 shadow-[0_28px_90px_rgba(0,0,0,.22),inset_0_1px_0_rgba(255,255,255,.045)] backdrop-blur-2xl hover:border-white/[0.15] hover:shadow-[0_32px_110px_rgba(0,0,0,.32),0_0_50px_rgba(83,45,105,.10)] sm:p-7"
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[#caa84f]/50 to-transparent opacity-35 transition-opacity group-hover:opacity-90"
      />
      <div
        aria-hidden
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(102,57,128,.16),transparent_70%)] blur-2xl"
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
