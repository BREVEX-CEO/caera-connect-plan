import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ParticleLogoIntro } from "./ParticleLogoIntro";
import { OcadeCompanion } from "@/components/ocade/OcadeCompanion";
import { useAppearance } from "@/lib/use-appearance";


/*
 * LAZY, AND THAT IS A BUDGET DECISION RATHER THAN A HABIT.
 *
 * `three` is ~600 KiB of JavaScript. The asset gate caps any single chunk at
 * 537 KiB and the whole application's JavaScript at 3.75 MiB, of which ~700 KiB
 * was spare. Imported statically it lands in the entry graph, so every visitor
 * to every route downloads a 3D engine to read a settings page.
 *
 * Split out here it becomes its own chunk, fetched only when this hero mounts,
 * and the rest of the product is unchanged. The page renders its text and
 * buttons immediately either way — see the Suspense fallback, which is the dark
 * background the design already has.
 */
const SolarSystem = lazy(() => import("./SolarSystem").then((m) => ({ default: m.SolarSystem })));
import {
  PLANETS,
  INTRO_TIMELINE,
  introPhaseAt,
  introSeen,
  markIntroSeen,
  forgetIntro,
  chooseRenderTier,
  type IntroPhase,
  type Planet,
  type RenderTier,
} from "@/lib/landing/universe";

/**
 * The landing experience: an opening, then a system you can play with.
 *
 * THE FIRST SCREEN IS THE PRODUCT, NOT A DESCRIPTION OF IT. There is no
 * paragraph explaining what OCADE is, because a sentence read once is worth
 * less than thirty seconds spent turning a solar system — and the sentence was
 * competing with the only thing on the page anyone remembers. The identity, a
 * scroll cue, and eight planets you can drag. Nothing else.
 *
 * THE CANVAS IS STICKY, NOT FIXED, and that is load-bearing rather than
 * stylistic. `position: fixed` is contained by any ancestor with a `transform`
 * or `perspective`, and the application's depth scene sets `perspective` on its
 * scroll container — a fixed canvas would be trapped inside it and scroll away.
 * Sticky is unaffected, and it produces the effect the page is after anyway:
 * the system stays behind the content as the sections move over it, so the
 * planets carry through the whole page instead of the page being a stack of
 * separate rectangles.
 *
 * THE OPENING PLAYS ONCE PER DEVICE. Remembered in `localStorage`, with a
 * replay control. By the third visit an unskippable five seconds is not
 * atmosphere, it is a toll.
 *
 * REDUCED MOTION IS ABSOLUTE. `prefers-reduced-motion` skips the sequence and
 * paints a single still frame — someone who asked their operating system to
 * stop animations usually did it because animation makes them ill.
 *
 * THE CANVAS IS DECORATION; THE CAPABILITY LIST IS THE INTERFACE. Every planet
 * is also a real button further down the page, so the eight capabilities are
 * reachable by keyboard and readable by a screen reader without touching the
 * animation.
 */
export function LandingUniverse() {
  /*
   * The preference comes from the appearance context, which already merges the
   * OS media query with the switch in Settings > Appearance. Reading the media
   * query here instead — as this did — meant the in-app switch had no effect on
   * the one screen with the most motion in the product.
   */
  const appearance = useAppearance();
  const reducedMotion = appearance.reducedMotion || appearance.osReducedMotion;
  const [phase, setPhase] = useState<IntroPhase>("ambient");
  const [hovered, setHovered] = useState<Planet | null>(null);
  const [tier, setTier] = useState<RenderTier>("full");
  const [scrolled, setScrolled] = useState(false);
  const startedAt = useRef<number>(0);

  /*
   * Clicking a planet, and pressing its card, are the same act: both pin it,
   * and a pinned planet is the one the camera moves toward. Two routes to one
   * behaviour rather than two half-features.
   */
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const pinned = useMemo(() => PLANETS.find((p) => p.id === pinnedId) ?? null, [pinnedId]);
  const active = pinned ?? hovered;



  useEffect(() => {
    const navigatorish = navigator as Navigator & { deviceMemory?: number };
    setTier(
      chooseRenderTier({
        reducedMotion,
        cores: navigatorish.hardwareConcurrency,
        memoryGb: navigatorish.deviceMemory,
        viewportWidth: window.innerWidth,
      }),
    );
  }, [reducedMotion]);

  /*
   * Past the first screen the identity belongs in the corner and the scroll cue
   * has done its job.
   *
   * AN OBSERVER RATHER THAN A SCROLL LISTENER. A `scroll` handler runs on the
   * main thread for every one of the dozens of events a single wheel gesture
   * produces, and each run here would read `innerHeight` — a layout property —
   * while the page is mid-scroll. On the one screen in the product that is also
   * running a 60fps canvas, that is the cheapest thing to get wrong.
   *
   * An IntersectionObserver answers the same question off the main thread and
   * fires twice: once when the sentinel leaves, once when it comes back.
   */
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(sentinel);

    /*
     * A SAFETY NET, NOT A SECOND IMPLEMENTATION. IntersectionObserver callbacks
     * are delivered as part of the rendering steps, and a browser that has
     * suspended those — a background tab, a window that is not compositing —
     * delivers nothing at all, not even the initial observation. If the page
     * were then scrolled and brought forward, the identity would be stranded in
     * the middle of the screen over the content it is supposed to have left.
     *
     * One comparison per scroll event, against a height cached on resize rather
     * than read per event, so it costs nothing on the one screen that is also
     * driving a 60fps canvas. Whichever fires first wins; they agree.
     */
    let viewport = window.innerHeight;
    const measure = () => {
      viewport = window.innerHeight;
    };
    const onScroll = () => setScrolled(window.scrollY > viewport * 0.18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const runIntro = useMemo(() => {
    if (typeof window === "undefined") return false;
    return !reducedMotion && !introSeen();
  }, [reducedMotion]);

  const play = useMemo(
    () => () => {
      setPhase("wordmark");
      startedAt.current = performance.now();
      let frame = 0;
      const tick = () => {
        const next = introPhaseAt(performance.now() - startedAt.current);
        setPhase(next);
        if (next === "ambient") {
          markIntroSeen();
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    },
    [],
  );

  useEffect(() => {
    if (!runIntro) {
      setPhase("ambient");
      return;
    }
    return play();
  }, [runIntro, play]);

  const introRunning = phase !== "ambient";
  // The identity is large and centred only while the opening runs and the
  // reader is still on the first screen.
  const centred = introRunning || !scrolled;

  return (
    <div className="relative">
      {/*
        The system, behind everything, for the whole scroll. `pointer-events`
        stay on so it can be dragged anywhere it is visible; the content above
        re-enables its own.
      */}
      <div className="pointer-events-none sticky top-0 z-0 h-[100svh] overflow-hidden">
        {/*
          The 3D system. `Suspense` falls back to nothing rather than a spinner:
          the background is already dark and the identity is already drawn over
          it, so an empty frame for the moment the chunk arrives looks like the
          page loading, while a spinner looks like something being wrong.
        */}
        <Suspense fallback={null}>
          <SolarSystem className="pointer-events-auto absolute inset-0 h-full w-full" />
        </Suspense>
        {/* Keeps text legible over the brightest part of the field. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,oklch(0.06_0.01_90/0.78)_100%)]"
        />
        {/*
          Deepens as the reader leaves the hero, so the sections below sit on a
          calm ground while the planets keep moving behind them.
        */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-background transition-opacity duration-700",
            scrolled ? "opacity-70" : "opacity-0",
          )}
        />
      </div>

      <ParticleLogoIntro phase={phase} reducedMotion={reducedMotion} tier={tier} />

      {/*
        THE IDENTITY. One element that travels: centred and large during the
        opening, then shrinking into the top-left corner as the reader scrolls.
        Animating position and scale on a single node is what makes it read as
        the same mark moving, rather than one title disappearing and another
        appearing.
      */}
      <div
        className={cn(
          "pointer-events-none fixed z-30 will-change-transform",
          "transition-all duration-[1100ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "motion-reduce:transition-none",
          phase === "wordmark" ? "scale-95 opacity-0" : "scale-100 opacity-100",
          centred
            ? "left-1/2 top-[42svh] -translate-x-1/2 -translate-y-1/2 text-center"
            : "left-4 top-3 translate-x-0 translate-y-0 text-left sm:left-6 sm:top-4",
        )}
      >
        <h1
          className={cn(
            "relative",
            "transition-all duration-[1100ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]",
            "motion-reduce:transition-none",
            centred ? "w-[82vw] max-w-[900px]" : "w-[210px] sm:w-[250px]",
          )}
        >
          <span className="sr-only">OCADE by CAERA CADANE — Command the Next Era.</span>
          <img
            src="/brand/ocade-wordmark.png"
            alt=""
            width={1480}
            height={383}
            className="h-auto w-full drop-shadow-[0_16px_45px_rgba(0,0,0,0.75)]"
            fetchPriority="high"
          />
        </h1>
      </div>

      {/* ------------------------------------------------------- the hero -- */}
      <section
        aria-label="OCADE"
        /*
          `pointer-events-none` ON THE HERO ITSELF, and it is load-bearing.
          This section is pulled up over the sticky canvas by `-mt-[100svh]`, so
          it covers the entire first screen. Left interactive it swallowed every
          pointerdown in the middle of the hero — measured with
          `elementFromPoint` at the centre of the viewport, which returned this
          section rather than the canvas — so dragging to rotate the system did
          nothing anywhere except the thin margins. The scene was fully built,
          fully rendering, and unreachable by the mouse.

          The children that need pressing re-enable it for themselves.
        */
        className="pointer-events-none relative z-10 -mt-[100svh] flex h-[100svh] flex-col justify-end px-4 pb-10"
      >
        {/*
          The sentinel the observer above watches. Sits a fifth of the way down
          the hero, so the identity commits to the corner early in the gesture
          rather than dithering at the boundary.
        */}
        <div ref={sentinelRef} aria-hidden className="absolute left-0 top-[18svh] h-px w-px" />
        {/*
          The only thing on the first screen besides the identity. Transparent,
          low, and out of the way of the system it is pointing at.
        */}
        <div
          className={cn(
            "mx-auto flex flex-col items-center gap-5 transition-opacity duration-700",
            introRunning || scrolled ? "pointer-events-none opacity-0" : "opacity-100",
          )}
        >
          {/*
            The tagline and both actions, over the scene.

            `pointer-events-none` on the wrapper with `auto` on the buttons: a
            drag started anywhere in this band has to reach the 3D system
            underneath, or the bottom third of the hero becomes a dead zone
            where the scene cannot be turned. Only the two buttons take the
            pointer back.
          */}
          <p className="pointer-events-none max-w-md text-balance text-center text-[14px] leading-relaxed text-muted-foreground">
            A private AI assistant that runs on your own hardware wherever it can.
          </p>

          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-7 text-[13.5px] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              Get started
            </Link>
            <Link
              to="/demo/ocade"
              className="inline-flex h-11 items-center justify-center rounded-full border border-border/70 bg-background/40 px-7 text-[13.5px] font-medium text-foreground backdrop-blur transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Try the demo
            </Link>
            <Link
              to="/download"
              className="inline-flex h-11 items-center justify-center rounded-full px-4 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Desktop app
            </Link>
          </div>

          <p className="pointer-events-none rounded-full border border-border/40 bg-background/30 px-4 py-1.5 text-[12px] text-muted-foreground/90 backdrop-blur-sm">
            Scroll down to sign in or get started{" "}
            <ArrowDown className="ml-0.5 inline h-3 w-3" aria-hidden />
          </p>
          {tier !== "static" ? (
            <p className="text-[11px] text-muted-foreground/50">
              Drag to turn · scroll to zoom · click a planet
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground/50">
              Motion reduced, following your system setting.
            </p>
          )}
        </div>

        {!introRunning ? (
          <OcadeCompanion
            label="I can answer locally, then—with permission—work through the signed desktop companion."
            className="pointer-events-none absolute bottom-6 right-4 hidden xl:flex"
          />
        ) : null}
      </section>

      {/* ------------------------------------------------------ try it -- */}
      <Panel>
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-primary/80">
          Try it first
        </p>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-[44px]">
          Twenty-eight minutes.
          <br />
          No account.
        </h2>
        <div className="mt-9">
          <Link
            to="/demo/ocade"
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-[14px] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            Open the demo
          </Link>
        </div>
      </Panel>

      {/* ------------------------------------------------------ sign in -- */}
      <Panel>
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-[40px]">
          Keep your work.
        </h2>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            to="/auth"
            className="inline-flex h-12 items-center justify-center rounded-full border border-border/70 bg-background/40 px-8 text-[14px] font-medium text-foreground backdrop-blur transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Create account
          </Link>
          <Link
            to="/auth"
            className="inline-flex h-12 items-center justify-center rounded-full px-5 text-[14px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign in
          </Link>
        </div>
      </Panel>

      {/* ------------------------------------------------- capabilities -- */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-28 pt-16">
        <h2 className="sr-only">What OCADE does</h2>
        <ul className="grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-4">
          {PLANETS.map((planet) => {
            const isActive = active?.id === planet.id;
            const isPinned = pinnedId === planet.id;
            return (
              <li key={planet.id}>
                {/*
                  No card, no border, no box. The planet's own colour is the
                  only ornament, and pressing one moves the camera to it — the
                  list and the scene are one control, which is why neither needs
                  decoration to look connected.
                */}
                <button
                  type="button"
                  onClick={() =>
                    setPinnedId((current) => (current === planet.id ? null : planet.id))
                  }
                  onMouseEnter={() => setHovered(planet)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(planet)}
                  onBlur={() => setHovered(null)}
                  aria-pressed={isPinned}
                  aria-describedby={`planet-benefit-${planet.id}`}
                  className="group w-full rounded-lg text-left transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full transition-transform",
                        isActive || isPinned ? "scale-[1.9]" : "scale-100",
                      )}
                      style={{ backgroundColor: `oklch(0.8 0.13 ${planet.hue})` }}
                    />
                    <span
                      className={cn(
                        "truncate text-[13.5px] font-medium transition-colors",
                        isPinned || isActive ? "text-foreground" : "text-foreground/80",
                      )}
                    >
                      {planet.name}
                    </span>
                  </span>
                  <span
                    id={`planet-benefit-${planet.id}`}
                    className="mt-1.5 block text-[12px] leading-relaxed text-muted-foreground"
                  >
                    {planet.benefit}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-14 flex justify-center">
          {tier !== "static" ? (
            <button
              type="button"
              onClick={() => {
                forgetIntro();
                play();
                window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
              }}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Replay the opening
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/**
 * A full-height band of content over the system.
 *
 * Deliberately not a card: no border, no panel, no background. The depth comes
 * from the darkened field behind it, which is a real surface rather than a
 * rectangle drawn to look like one.
 */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative z-10 mx-auto flex min-h-[62svh] w-full max-w-5xl flex-col justify-center px-4">
      <div className="max-w-2xl">{children}</div>
    </section>
  );
}

/** Exported for the test that pins the intro timing. */
export const INTRO_PHASES = INTRO_TIMELINE;
