import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAppearance } from "@/lib/use-appearance";
import {
  createScene,
  tuningFor,
  type BackdropIntensity,
  type SceneHandle,
} from "./living-backdrop-scene";

/**
 * The Living Intelligence backdrop.
 *
 * Decorative only: `aria-hidden`, no pointer events, always behind content. It
 * carries no information, so a reader who never sees it loses nothing — which
 * is the test any purely atmospheric surface has to pass in a product where
 * the foreground includes a Stop button.
 *
 * IT YIELDS. Reduced motion (OS or app), low-performance mode, and a hidden
 * tab each stop the loop; high contrast removes the backdrop entirely rather
 * than dimming it, because "slightly less texture behind the text" is not what
 * somebody asking for high contrast is asking for.
 *
 * `intensity="subtle"` is for reading surfaces (Chat). `"cinematic"` is for
 * Control + Work, where the room should feel like a cockpit — but even there
 * the controls above it are opaque, not glass.
 */
export function LivingIntelligenceBackdrop({
  intensity = "subtle",
  className,
}: {
  intensity?: BackdropIntensity;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appearance = useAppearance();
  /*
   * Three independent reasons to hold still, and all of them must win: the OS
   * setting, the in-app override, and the automatic fallback the detector
   * turns on for slow devices.
   */
  const still =
    appearance.reducedMotion ||
    appearance.osReducedMotion ||
    appearance.lowPerformance ||
    appearance.perfFallback.active;
  const highContrast = appearance.highContrast;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tuning = tuningFor(intensity, { still, highContrast });
    if (tuning.opacity === 0) return;

    let scene: SceneHandle | null = createScene(canvas, { intensity, tuning });
    if (!scene) return;

    const parent = canvas.parentElement;
    const measure = () => {
      const rect = parent?.getBoundingClientRect();
      scene?.resize(rect?.width ?? window.innerWidth, rect?.height ?? window.innerHeight);
    };
    measure();

    let raf = 0;
    let start = 0;
    /*
     * `elapsed` is wall-clock, not a frame counter, so a paused tab does not
     * "catch up" with a burst of motion when it comes back — it resumes where
     * the clock is, which is what the eye expects.
     */
    const loop = (now: number) => {
      if (!start) start = now;
      scene?.frame((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const play = () => {
      if (raf || still) return;
      raf = requestAnimationFrame(loop);
    };

    if (still) {
      // One frame, then nothing. The composition is visible; it does not move.
      scene.frame(0);
    } else {
      play();
    }

    const onVisibility = () => {
      if (document.hidden) stop();
      else play();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && parent) {
      ro = new ResizeObserver(() => {
        measure();
        if (still) scene?.frame(0);
      });
      ro.observe(parent);
    } else {
      window.addEventListener("resize", measure);
    }

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", measure);
      scene?.dispose();
      scene = null;
    };
  }, [intensity, still, highContrast]);

  if (highContrast) return null;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        // A flat obsidian floor under the canvas so the scene never shows the
        // page background through its transparent regions.
        "bg-[radial-gradient(120%_90%_at_50%_20%,rgba(10,12,24,0.9),rgba(3,4,9,0.96))]",
        className,
      )}
    >
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
}
