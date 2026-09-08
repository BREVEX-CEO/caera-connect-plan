import { useEffect, useRef, useState } from "react";
import {
  createSolarScene,
  DECLINED,
  type QualityTier,
  type SceneHandles,
} from "@/lib/landing/solar-scene";
import { useAppearance } from "@/lib/use-appearance";
import { scenesShouldRun } from "@/lib/landing/renderer-capability";

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
   * Set when there IS WebGL and it is being rasterised by the CPU. Kept apart
   * from `failed` because the two are different facts and the page says so:
   * one is "this browser cannot", the other is "this machine should not".
   */
  const [declined, setDeclined] = useState(false);

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
     * It used to be a `<canvas ref>` in the markup, so React owned one element
     * for the component's lifetime and every mount handed the SAME canvas to
     * `createSolarScene`. In development React runs an effect, tears it down and
     * runs it again to surface exactly this class of bug; the second run then
     * asked for a WebGL context on a canvas whose context had just been
     * disposed, which throws. The `catch` set `failed`, the canvas went
     * `display: none`, and the hero rendered no 3D whatsoever — on a scene that
     * was otherwise complete and correct. It failed silently because the caught
     * error was discarded.
     *
     * A canvas element can hand out exactly one context, ever. So each mount
     * gets its own element and drops it on cleanup, which makes context reuse
     * structurally impossible rather than something to remember.
     */
    /*
     * ASK BEFORE BUILDING. A software rasteriser costs roughly 300 ms per
     * frame on the main thread, and no quality tier rescues that — see
     * `renderer-capability.ts` for the measurement. The page keeps everything
     * the canvas would have shown, because all of it is real text elsewhere.
     */
    const capability = scenesShouldRun();
    if (!capability.run) {
      setDeclined(true);
      return;
    }
    setDeclined(false);

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "display:block;width:100%;height:100%;touch-action:none;user-select:none;";
    wrap.insertBefore(canvas, wrap.firstChild);

    const tier = pickTier(holdStill);

    let scene: SceneHandles;
    try {
      const rect = wrap.getBoundingClientRect();
      scene = createSolarScene(canvas, rect.width || 1, rect.height || 1, tier);
    } catch (error) {
      /*
       * No WebGL — an old machine, a locked-down profile, a software renderer
       * that refused. Reported as a state rather than a crash: the page keeps
       * its text and buttons, which is the part that matters.
       *
       * LOGGED, NOT SWALLOWED. A bare `catch {}` here is what hid the defect
       * above for as long as it existed: the hero silently showed nothing and
       * there was no way to find out why without instrumenting the file.
       */
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
    let labelTick = 0;

    const loop = (now: number) => {
      if (!running) return;
      /*
       * HELD STILL MEANS dt = 0. The loop keeps running so a deliberate drag or
       * zoom still repaints — someone who asked for less motion asked for
       * nothing to move ON ITS OWN, not to be handed a frozen picture they
       * cannot turn — but the clock never advances, so orbits, rotation and the
       * idle camera return produce no movement at all.
       */
      const elapsed = (now - last) / 1000;
      const dt = holdStill ? 0 : elapsed;
      last = now;

      // Five seconds after the last deliberate act, the camera finds its way
      // back — including from mid-zoom. Not while held still: that is motion
      // the person did not ask for.
      if (!holdStill && now - lastInteraction > IDLE_RETURN_MS) scene.goHome();

      scene.frame(dt);

      // Labels are React state, so they are updated at ~12Hz rather than every
      // frame: re-rendering 28 elements at 60Hz costs more than the entire 3D
      // scene does, and the labels do not move fast enough to need it.
      //
      // Ticked on REAL elapsed time, not the scene clock: with the scene held
      // still the clock never advances, and a label pass that waited on it
      // would never run — leaving the still frame unlabelled.
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
      scene.orbitBy(event.movementX, event.movementY);
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      // A drag that starts here must not select the headline behind it.
      document.body.style.userSelect = "none";
      touched();
    };

    const endDrag = (event?: PointerEvent) => {
      dragging = false;
      if (event) canvas.releasePointerCapture(event.pointerId);
      document.body.style.userSelect = "";
      touched();
    };

    const onWheel = (event: WheelEvent) => {
      const { x, y } = toNdc(event);
      scene.setPointer(x, y);
      /*
       * ASK FIRST, THEN DECIDE WHETHER TO KEEP THE GESTURE.
       *
       * This used to `preventDefault()` unconditionally before calling `zoom`,
       * and the canvas covers the whole first screen — so "Scroll down to sign
       * in or get started" was impossible to obey. Measured: eight wheel events
       * over the hero, eight prevented, `scrollY` still 0.
       *
       * The scene returns DECLINED once it is pulled all the way out and has
       * nothing left to do with the gesture. Then the wheel belongs to the
       * page and the reader continues to the next section, which is the whole
       * point of the cue above the fold.
       */
      touched();
      const used = scene.zoom(event.deltaY);
      if (used !== DECLINED) event.preventDefault();
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", (e) => endDrag(e));
    canvas.addEventListener("pointerleave", () => endDrag());
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
      canvas.removeEventListener("wheel", onWheel);
      document.body.style.userSelect = "";
      scene.dispose();
      // The element goes with the context it owned. Leaving it would keep a
      // dead canvas in the tree and, on remount, a second one beside it.
      canvas.remove();
      sceneRef.current = null;
    };
    // Rebuilt when the motion preference changes: the quality tier is chosen at
    // construction, so a scene built for movement cannot simply be told to stop.
  }, [holdStill]);

  return (
    <div
      ref={wrapRef}
      className={className}
      data-scene={declined ? "declined" : failed ? "unavailable" : "live"}
    >
      {/*
        The canvas is inserted here by the effect rather than rendered by React
        — see the note above. It carries `aria-hidden`, like the scene it
        replaced: everything it shows is available as real text elsewhere on the
        page, and announcing a canvas that says nothing adds noise, not access.
      */}

      {/*
        Moon names, as DOM rather than in the scene. Text drawn into WebGL at
        this size is either blurry or costs a texture atlas; the browser already
        has a subpixel text renderer and it is free.
      */}
      {labels.map((label) => (
        <span
          key={label.name}
          aria-hidden
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] tracking-wide text-white"
          style={{
            left: `${label.x * 100}%`,
            top: `${label.y * 100}%`,
            opacity: label.opacity,
            textShadow: "0 1px 3px rgba(0, 0, 0,0.9)",
          }}
        >
          {label.name}
        </span>
      ))}
    </div>
  );
}
