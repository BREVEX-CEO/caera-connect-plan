import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { IntroPhase, RenderTier } from "@/lib/landing/universe";

interface ParticleLogoIntroProps {
  phase: IntroPhase;
  reducedMotion: boolean;
  tier: RenderTier;
}

interface Particle {
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetY: number;
  size: number;
  delay: number;
}

/**
 * PARTICLES GROUPED BY COLOUR, WHICH IS THE WHOLE PERFORMANCE STORY HERE.
 *
 * The draw loop used to assign `fillStyle` a freshly built `rgba(...)` string
 * for every particle on every frame. Assigning `fillStyle` a string makes the
 * canvas PARSE a CSS colour; at roughly fourteen hundred particles and sixty
 * frames that is eighty-four thousand colour parses a second, and the profiler
 * put more of the landing route's blocking time in this function than anywhere
 * else in the product.
 *
 * The brand mark is a handful of golds and a white, so the colours are
 * quantised into buckets at build time. The loop then sets `fillStyle` once per
 * bucket — a few times a frame — and varies only `globalAlpha`, which is a
 * numeric setter with nothing to parse.
 */
interface ColourBucket {
  colour: string;
  particles: Particle[];
}

/**
 * HOW LONG ONE FRAME OF THE INTRO IS ALLOWED TO TAKE.
 *
 * A task over 50 ms is, by the definition of Total Blocking Time, a task the
 * page spends ignoring taps — so a decorative animation that needs more than
 * this per frame is not an animation, it is a stall with a picture on it.
 * 24 ms leaves room for the rest of the frame's work and still permits a real
 * 30fps on a slow machine.
 */
const FRAME_BUDGET_MS = 24;

/**
 * How many consecutive over-budget frames end the intro.
 *
 * One is not enough: the first frame after the particles are built pays for the
 * canvas's first composite and is legitimately slower than the rest. Two in a
 * row is a machine that cannot do this, and the page is better without it —
 * everything the canvas draws is the brand mark, which is also a real image and
 * a real heading directly beneath it.
 */
const OVER_BUDGET_FRAMES_ALLOWED = 2;

/**
 * How long the intro will wait for an idle moment before playing anyway.
 *
 * A page that never goes idle — a slow machine still settling, a background tab
 * that just became visible — would otherwise never play it, and a decorative
 * animation that silently does not happen reads as a broken site rather than as
 * a deliberate saving.
 */
const IDLE_TIMEOUT_MS = 1_200;

/** The same wait, for Safari, which has no `requestIdleCallback`. */
const IDLE_FALLBACK_MS = 400;

/** Deterministic random numbers keep the formation identical on every replay. */
function randomGenerator(seed = 0x0cade28) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function easeOutQuint(value: number) {
  const bounded = Math.min(1, Math.max(0, value));
  return 1 - (1 - bounded) ** 5;
}

/**
 * Builds the OCADE seal from depth-scattered particles.
 *
 * The source is the same-origin brand asset, so the animation remains usable
 * offline and never pulls a logo, font or script from a CDN. The canvas is
 * decorative; the real heading directly beneath it remains selectable,
 * keyboard-safe and readable by assistive technology.
 */
export function ParticleLogoIntro({ phase, reducedMotion, tier }: ParticleLogoIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = phase !== "ambient" && !reducedMotion && tier !== "static";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let animationFrame = 0;
    let cancelled = false;
    let buckets: ColourBucket[] = [];
    let width = 0;
    let height = 0;
    let ratio = 1;
    const startedAt = performance.now();
    const random = randomGenerator();

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const image = new Image();
    image.decoding = "async";
    image.src = "/brand/ocade-carcc-mark.png";

    const buildParticles = () => {
      const sampleSize = tier === "full" ? 240 : 180;
      const sample = document.createElement("canvas");
      sample.width = sampleSize;
      sample.height = sampleSize;
      const sampleContext = sample.getContext("2d", { willReadFrequently: true });
      if (!sampleContext) return;
      sampleContext.drawImage(image, 0, 0, sampleSize, sampleSize);
      const pixels = sampleContext.getImageData(0, 0, sampleSize, sampleSize).data;
      const step = tier === "full" ? 4 : 5;
      const scale = Math.min(width, height) * 0.52;
      const left = width / 2 - scale / 2;
      const top = height * 0.42 - scale / 2;
      const next = new Map<number, ColourBucket>();

      for (let y = 0; y < sampleSize; y += step) {
        for (let x = 0; x < sampleSize; x += step) {
          const offset = (y * sampleSize + x) * 4;
          const alpha = pixels[offset + 3];
          const luminance = pixels[offset] + pixels[offset + 1] + pixels[offset + 2];
          if (alpha < 72 || luminance < 54) continue;
          const angle = random() * Math.PI * 2;
          const radius = Math.max(width, height) * (0.42 + random() * 0.52);
          /*
           * Five bits of luminance — 32 levels, so at most a few dozen buckets
           * for the monochrome seal. Quantising further would band the mark;
           * quantising less would put the colour parse back in the inner loop
           * for a difference nobody can see at two pixels across.
           */
          const bucketLuminance =
            Math.round((pixels[offset] + pixels[offset + 1] + pixels[offset + 2]) / 3 / 8) * 8;
          const key = bucketLuminance;
          let bucket = next.get(key);
          if (!bucket) {
            bucket = {
              colour: `rgb(${bucketLuminance},${bucketLuminance},${bucketLuminance})`,
              particles: [],
            };
            next.set(key, bucket);
          }
          bucket.particles.push({
            startX: width / 2 + Math.cos(angle) * radius,
            startY: height * 0.42 + Math.sin(angle) * radius,
            startZ: -900 + random() * 1_800,
            targetX: left + (x / sampleSize) * scale,
            targetY: top + (y / sampleSize) * scale,
            size: 0.65 + random() * 1.5,
            delay: random() * 0.34,
          });
        }
      }
      buckets = [...next.values()];
    };

    /*
     * THE INTRO GIVES UP RATHER THAN STUTTERS.
     *
     * Measured on the web-vitals harness at four-times CPU throttling, this
     * loop was the single largest remaining contributor to the landing route's
     * blocking time — 413 ms of self time, on the one visit where a person is
     * deciding whether to stay. A first-time visitor was paying for the intro
     * with the page's responsiveness.
     *
     * So the loop watches its own cost. Two consecutive frames over budget
     * and it stops, clears the canvas and leaves the page to its real content:
     * the brand mark and the heading beneath the canvas are DOM, and were
     * always the accessible version of what this draws.
     */
    let overBudgetFrames = 0;

    const draw = (now: number) => {
      if (cancelled) return;
      const frameStarted = performance.now();
      context.clearRect(0, 0, width, height);
      const elapsed = (now - startedAt) / 1_950;
      context.save();
      context.globalCompositeOperation = "lighter";

      for (const bucket of buckets) {
        context.fillStyle = bucket.colour;
        for (const particle of bucket.particles) {
          const progress = easeOutQuint((elapsed - particle.delay) / (1 - particle.delay));
          if (progress <= 0) continue;
          const z = particle.startZ * (1 - progress);
          const perspective = 760 / Math.max(120, 760 + z);
          const x =
            (particle.startX + (particle.targetX - particle.startX) * progress - width / 2) *
              perspective +
            width / 2;
          const y =
            (particle.startY + (particle.targetY - particle.startY) * progress - height * 0.42) *
              perspective +
            height * 0.42;
          context.globalAlpha = Math.min(1, progress * 1.7) * (0.52 + perspective * 0.36);
          /*
           * A SQUARE RATHER THAN A CIRCLE, and at this size that is not a
           * compromise. These are between one and four pixels across under
           * additive compositing; `beginPath`/`arc`/`fill` builds and
           * rasterises a path for each one, while `fillRect` is a single call
           * into the same rasteriser with no path at all.
           */
          const diameter = Math.max(0.9, particle.size * perspective * 2);
          context.fillRect(x - diameter / 2, y - diameter / 2, diameter, diameter);
        }
      }

      context.restore();

      if (performance.now() - frameStarted > FRAME_BUDGET_MS) {
        overBudgetFrames += 1;
        if (overBudgetFrames >= OVER_BUDGET_FRAMES_ALLOWED) {
          cancelled = true;
          context.clearRect(0, 0, width, height);
          return;
        }
      } else {
        // Consecutive, not cumulative: one slow frame while another tab
        // finishes loading is not this machine failing to keep up.
        overBudgetFrames = 0;
      }

      animationFrame = requestAnimationFrame(draw);
    };

    /*
     * THE INTRO WAITS FOR THE PAGE TO BE READY FOR IT.
     *
     * Profiled against the production build at four-times CPU throttling, this
     * component was 563 ms of self time on the landing route — `buildParticles`
     * alone a single 116 ms task, inside the window Total Blocking Time
     * measures. `/pricing` and `/support` share the same entry chunk and
     * measure 99 ms and 0 ms, so the difference was not the bundle: it was this.
     *
     * Nothing here is load-bearing. The brand mark this draws is also a real
     * image, and the heading beneath it is real text — both already painted,
     * both selectable and readable by assistive technology. So the whole thing
     * is scheduled for the first idle period instead of competing with first
     * paint for the main thread.
     *
     * `requestIdleCallback` WITH A TIMEOUT, and a `setTimeout` fallback for
     * Safari, which does not implement it. The timeout matters: a page that
     * never goes idle would otherwise never play the intro at all, and a
     * decorative animation that silently does not happen is a bug people report
     * as "the site looks broken on my machine".
     */
    let startHandle: number | undefined;
    let idleHandle: number | undefined;

    const begin = () => {
      if (cancelled) return;
      resize();
      if (image.complete && image.naturalWidth > 0) buildParticles();
      else image.addEventListener("load", buildParticles, { once: true });
      observer.observe(canvas);
      animationFrame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(() => {
      resize();
      if (image.complete && image.naturalWidth > 0) buildParticles();
    });

    const idle = (
      window as Window &
        typeof globalThis & {
          requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
          cancelIdleCallback?: (handle: number) => void;
        }
    ).requestIdleCallback;
    if (typeof idle === "function") idleHandle = idle(begin, { timeout: IDLE_TIMEOUT_MS });
    else startHandle = window.setTimeout(begin, IDLE_FALLBACK_MS);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      if (startHandle !== undefined) window.clearTimeout(startHandle);
      if (idleHandle !== undefined) {
        (
          window as Window & typeof globalThis & { cancelIdleCallback?: (handle: number) => void }
        ).cancelIdleCallback?.(idleHandle);
      }
      observer.disconnect();
      image.removeEventListener("load", buildParticles);
      context.clearRect(0, 0, width, height);
    };
  }, [active, tier]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 z-20 h-[100svh] w-full transition-opacity duration-700",
        phase === "ignition" ? "opacity-0" : "opacity-100",
      )}
    />
  );
}
