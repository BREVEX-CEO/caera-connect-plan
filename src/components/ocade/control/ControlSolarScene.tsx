import { useEffect, useRef } from "react";
import {
  motionFor,
  paintControlSystem,
  type ControlState,
  type SceneQuality,
} from "@/lib/work/control-solar";
import { cn } from "@/lib/utils";

/**
 * The Control + Work system, mounted.
 *
 * THE PHASE IS INTEGRATED, NOT COMPUTED FROM ELAPSED TIME. Each frame advances
 * an accumulator by `dt * orbitRate`, so switching from `controlling` (1.6x) to
 * `paused` (0.22x) slows the system from exactly where it was. Multiplying
 * elapsed time by the current rate instead would jump every planet to a new
 * angle the moment the state changed — a stutter, on the one screen whose job
 * is to report what is happening truthfully.
 *
 * THE ANIMATION YIELDS TO THE WORK. This canvas shares a main thread with an
 * agent loop, a streaming local model, and a person trying to press Stop. So it
 * measures its own cost and gets out of the way:
 *
 *   - Frame time is tracked as a rolling mean. Over `SLOW_MS` it drops a
 *     quality tier; comfortably under, it earns one back. Two tiers down, the
 *     scene is rings, discs and moons — still the whole system, just cheaper.
 *   - Device pixel ratio is capped, and capped harder once quality has fallen.
 *     A 4K panel at DPR 2 is four times the fill cost of DPR 1 for a difference
 *     nobody looks at while their computer is being driven.
 *   - `stopped` and `error` are held states, so the loop parks itself after one
 *     settled frame and burns nothing until the state changes.
 *
 * REDUCED MOTION STOPS THE CLOCK AND DRAWS THE SYSTEM ONCE. Not a blank box:
 * the arrangement, the connections and Uranus's moons are all still there, and
 * the caption carries the state in words.
 */

/** Above this mean frame time, the scene is costing the product responsiveness. */
const SLOW_MS = 12;
const FAST_MS = 7;
const TIERS: SceneQuality[] = ["full", "reduced", "minimal"];

export function ControlSolarScene({
  state,
  amplitude = 0,
  className,
}: {
  state: ControlState;
  /** 0–1 speech amplitude. Only `speaking` reacts to it. */
  amplitude?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Read inside the frame loop so a state change never restarts the animation.
  const stateRef = useRef(state);
  const amplitudeRef = useRef(amplitude);
  stateRef.current = state;
  amplitudeRef.current = amplitude;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "display:block;width:100%;height:100%;";
    wrap.insertBefore(canvas, wrap.firstChild);

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      // The panel beside this scene is the interface; it must survive the
      // decoration failing.
      console.error("[OCADE] The Control + Work scene could not get a 2D context.");
      canvas.remove();
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let tier = 0;
    let meanFrameMs = 0;
    let sampled = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const cap = tier === 0 ? 2 : 1.25;
      const dpr = Math.min(cap, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let phase = 0;
    let elapsed = 0;
    let last = performance.now();
    let frame = 0;
    let running = true;
    let settledState: ControlState | null = null;

    const draw = (dt: number) => {
      elapsed += dt;
      const motion = motionFor({
        state: stateRef.current,
        time: elapsed,
        amplitude: amplitudeRef.current,
      });
      phase += dt * motion.orbitRate;
      paintControlSystem(context, {
        width,
        height,
        motion,
        phase,
        quality: TIERS[tier],
        // Eight names and a moon count need room; on a narrow panel they become
        // overlapping noise, so they are dropped rather than shrunk.
        labels: width > 520 && height > 380,
      });
    };

    if (reduced) {
      phase = 7.5;
      draw(0);
    } else {
      const loop = (now: number) => {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        /*
         * A held state does not need sixty frames a second of the same picture.
         * One settled frame, then the loop parks until something changes — so a
         * stopped mission costs nothing while the user reads what happened.
         */
        const current = stateRef.current;
        const held = current === "stopped" || current === "error";
        if (held && settledState === current) {
          frame = requestAnimationFrame(loop);
          return;
        }
        settledState = held ? current : null;

        const startedAt = performance.now();
        draw(dt);
        const cost = performance.now() - startedAt;
        meanFrameMs = sampled === 0 ? cost : meanFrameMs * 0.9 + cost * 0.1;
        sampled += 1;

        // Given a moment to settle, then adjusted. Reacting to the first frame
        // would drop quality on the one frame that also compiled the shaders,
        // laid out the page and warmed the JIT.
        if (sampled > 40) {
          if (meanFrameMs > SLOW_MS && tier < TIERS.length - 1) {
            tier += 1;
            sampled = 0;
            resize();
          } else if (meanFrameMs < FAST_MS && tier > 0) {
            tier -= 1;
            sampled = 0;
            resize();
          }
        }

        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }

    const observer = new ResizeObserver(() => {
      resize();
      settledState = null;
      if (reduced) draw(0);
    });
    observer.observe(wrap);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.remove();
    };
  }, []);

  const caption = motionFor({ state, time: 0, amplitude }).caption;

  return (
    <div ref={wrapRef} className={cn("relative", className)} data-control-state={state}>
      {/*
        The state in words. The scene is the ambient answer; this is the one a
        screen reader gets, and the one someone glancing at the panel reads
        without having to interpret an orbit rate.
      */}
      <p
        aria-live="polite"
        className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-medium uppercase tracking-[0.32em] text-[oklch(0.78_0.09_82)]/70"
      >
        {caption}
      </p>
    </div>
  );
}
