import { useEffect, useRef, useState } from "react";
import {
  createSolarScene,
  DECLINED,
  type QualityTier,
  type SceneHandles,
} from "@/lib/landing/solar-scene";
import { useAppearance } from "@/lib/use-appearance";

/**
 * The hero scene, mounted.
 *
 * EVERYTHING THE SCENE ALLOCATES IS RELEASED ON UNMOUNT. WebGL does not behave
 * like React state: geometries, materials, render targets and the context
 * itself outlive the component unless disposed by hand, and a browser will only
 * keep a handful of contexts alive before it starts silently killing the oldest
 * canvas. `dispose()` is called from the effect's cleanup, not from a route
 * guard or a timer.
 *
 * IDLE RETURN AT FIVE SECONDS, from wherever the camera is — mid-zoom on a
 * planet, deep in Uranus's moons, anywhere. It is written to the camera's
 * TARGET rather than its position, so the journey home is the same easing every
 * other camera move uses and there is no moment where control changes hands
 * visibly.
 *
 * REDUCED MOTION GETS A COMPOSED STILL, not a blank box. The system is drawn
 * once, at the framing the page was designed around, and the clock does not
 * advance. Dragging and zooming still work — someone who asked for less motion
 * asked for things to stop moving on their own, not to be handed a dead
 * rectangle where the product's opening image should be.
 */

const IDLE_RETURN_MS = 5000;
const CLICK_TRAVEL_PX = 7;

function pickTier(reducedMotion: boolean): QualityTier {
  if (reducedMotion) return "still";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  if (cores <= 2 || memory <= 2 || window.innerWidth < 640) return "reduced";
  return "full";
}

export function SolarSystem({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandles | null>(null);
  const [labels, setLabels] = useState<{ name: string; x: number; y: number; opacity: number }[]>(
    [],
  );
  const [failed, setFailed] = useState(false);

  /*
   * BOTH SOURCES OF THE PREFERENCE, not just the media query.
   *
   * This used to read `prefers-reduced-motion` directly, which quietly ignored
   * the switch in Settings > Appearance — the one people on a shared or locked
   * machine can actually reach. `useAppearance` carries the app preference and
   * the OS one, and either is enough to hold the scene still.
   */
  const { reducedMotion, osReducedMotion } = useAppearance();
  const holdStill = reducedMotion || osReducedMotion;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    /*
     * THE CANVAS IS CREATED HERE, NOT IN JSX — and this is the whole reason the
     * scene renders at all.
     *
     * A canvas element can hand out exactly one WebGL context for this use. A
     * fresh canvas per effect mount also makes React's development effect replay
     * safe instead of trying to resurrect a deliberately disposed context.
     */
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "display:block;width:100%;height:100%;touch-action:none;user-select:none;cursor:grab;";
    wrap.insertBefore(canvas, wrap.firstChild);

    const tier = pickTier(holdStill);

    let scene: SceneHandles;
    try {
      const rect = wrap.getBoundingClientRect();
      scene = createSolarScene(canvas, rect.width || 1, rect.height || 1, tier);
    } catch (error) {
      console.error("[OCADE] The hero scene could not start.", error);
      canvas.remove();
      setFailed(true);
      return;
    }
    setFailed(false);
    sceneRef.current = scene;

    let frame = 0;
    let last = performance.now();
    let lastInteraction = performance.now();
    let running = true;
    let dragging = false;
    let dragTravel = 0;
    let labelTick = 0;

    const loop = (now: number) => {
      if (!running) return;
      const elapsed = (now - last) / 1000;
      const dt = holdStill ? 0 : elapsed;
      last = now;

      if (!holdStill && now - lastInteraction > IDLE_RETURN_MS) scene.goHome();

      scene.frame(dt);

      // Labels are React state, so they are updated at ~12Hz rather than every
      // frame. Real elapsed time is used even when the 3D clock is held still.
      labelTick += elapsed;
      if (labelTick > 0.08) {
        labelTick = 0;
        const next = scene.moonLabels();
        setLabels((current) => (current.length === 0 && next.length === 0 ? current : next));
      }

      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const touched = () => {
      lastInteraction = performance.now();
    };

    const toNdc = (event: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const { x, y } = toNdc(event);
      scene.setPointer(x, y);
      if (!dragging) return;
      touched();
      dragTravel += Math.hypot(event.movementX, event.movementY);
      scene.orbitBy(event.movementX, event.movementY);
    };

    const onPointerDown = (event: PointerEvent) => {
      const { x, y } = toNdc(event);
      scene.setPointer(x, y);
      dragging = true;
      dragTravel = 0;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      touched();
    };

    const finishDrag = (event?: PointerEvent, activate = false) => {
      if (!dragging) return;
      const shouldActivate = activate && dragTravel < CLICK_TRAVEL_PX;
      dragging = false;
      if (event && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      canvas.style.cursor = "grab";
      document.body.style.userSelect = "";
      touched();

      if (shouldActivate && event) {
        const { x, y } = toNdc(event);
        scene.setPointer(x, y);
        // Reuse the scene's real proximity/focus path. A planet under the
        // pointer becomes the camera target and the post-process refraction
        // ripple fires; an empty-space click simply eases the system closer.
        scene.zoom(-260);
      }
    };

    const onPointerUp = (event: PointerEvent) => finishDrag(event, true);
    const onPointerCancel = (event: PointerEvent) => finishDrag(event, false);
    const onPointerLeave = () => finishDrag(undefined, false);

    const onWheel = (event: WheelEvent) => {
      const { x, y } = toNdc(event);
      scene.setPointer(x, y);
      touched();
      const used = scene.zoom(event.deltaY);
      if (used !== DECLINED) event.preventDefault();
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const observer = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      scene.resize(rect.width || 1, rect.height || 1);
    });
    observer.observe(wrap);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      document.body.style.userSelect = "";
      scene.dispose();
      canvas.remove();
      sceneRef.current = null;
    };
  }, [holdStill]);

  return (
    <div ref={wrapRef} className={className} data-scene={failed ? "unavailable" : "live"}>
      {labels.map((label) => (
        <span
          key={label.name}
          aria-hidden
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] tracking-wide text-white"
          style={{
            left: `${label.x * 100}%`,
            top: `${label.y * 100}%`,
            opacity: label.opacity,
            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
          }}
        >
          {label.name}
        </span>
      ))}
    </div>
  );
}
