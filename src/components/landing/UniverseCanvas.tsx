import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_CAMERA,
  MAX_ZOOM,
  clampCamera,
  focusPanFor,
  planetAtPointer,
  starCountFor,
  stepCamera,
  unfocusedTarget,
  type CameraMotion,
  type Planet,
  type PlanetPosition,
  type RenderTier,
} from "@/lib/landing/universe";
import { paintUniverse, makeStars, type Star } from "@/lib/landing/paint";

/**
 * The OCADE universe, drawn from code.
 *
 * NO IMAGES, NO VIDEO, NO 3D LIBRARY. Every pixel is a gradient, an arc or a
 * dot on a 2D canvas. That is a deliberate constraint and it buys three things
 * that matter more than a shader would: it weighs nothing next to a WebGL
 * engine, it renders identically on a machine with no GPU, and it degrades to
 * a still frame without a second code path.
 *
 * WHY CANVAS AND NOT WEBGL. The scene is eight spheres, eight orbit rings, eight
 * connecting wires and a few hundred stars. Canvas draws that at 60fps on the
 * integrated graphics this product targets, and a WebGL context on the same
 * hardware costs more to create than the whole scene costs to draw. Reaching
 * for shaders here would be choosing the impressive tool over the one that
 * works on the user's laptop.
 *
 * NOTHING IS EVER SET DIRECTLY — see `stepCamera`. Drag, flick, wheel, focus and
 * the idle return all write a TARGET, and the drawn camera is drawn towards it
 * every frame. There is no code path that can teleport the view, which is why
 * handing control back and forth between the user and the autonomous orbit has
 * no seam in it: the camera is always easing towards something, and only the
 * something changes.
 *
 * PERFORMANCE IS MEASURED, NOT ASSUMED. The loop watches its own frame times
 * and drops a tier when it misses budget, so a slow machine gets a calmer scene
 * instead of a stuttering one. On `prefers-reduced-motion` it paints one frame
 * and stops.
 *
 * IT IS NOT THE INTERFACE. The canvas is `aria-hidden` and every planet is
 * reachable as a real button in a list beside it — see `UniverseLegend`. A
 * keyboard user gets the same information without touching the animation.
 */

/** How far the lens pushes in when the view settles on one planet. */
const FOCUS_ZOOM = Math.min(2.9, MAX_ZOOM);

/**
 * How far the pointer may travel and still count as a click, in CSS pixels.
 *
 * Above this it was a drag, and a drag must not also select a planet — turning
 * the system and then having it lurch into a close-up of whatever happened to
 * be under the finger at the end is the single most irritating thing a scene
 * like this can do.
 */
const CLICK_SLOP_PX = 5;

export function UniverseCanvas({
  tier,
  paused,
  onHoverPlanet,
  onSelectPlanet,
  focusPlanetId,
  activePlanetId,
  className,
}: {
  tier: RenderTier;
  /** Freeze the clock without unmounting — used while the intro text runs. */
  paused?: boolean;
  onHoverPlanet?: (planet: Planet | null) => void;
  /** A click on a planet, or on empty space (null) to let go of it. */
  onSelectPlanet?: (planet: Planet | null) => void;
  /** The planet the camera should settle on, or null to frame the system. */
  focusPlanetId?: string | null;
  activePlanetId?: string | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motionRef = useRef<CameraMotion>({
    current: { ...DEFAULT_CAMERA },
    target: { ...DEFAULT_CAMERA },
    yawVelocity: 0,
    pitchVelocity: 0,
  });
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef<{
    x: number;
    y: number;
    at: number;
    travelled: number;
    vx: number;
    vy: number;
  } | null>(null);
  const positionsRef = useRef<PlanetPosition[]>([]);
  const hoveredRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);

  /*
   * State the draw loop reads but must not RESTART for.
   *
   * THE DEFECT THIS FIXES. `elapsed` used to be a local inside the effect, and
   * the effect listed `activePlanetId` and `paused` among its dependencies. So
   * every hover over a planet tore the loop down and built a new one with
   * `elapsed` back at zero — and every planet snapped to its t=0 position.
   * Moving the pointer across the legend made the whole system jump backwards
   * eight times in a row. It was invisible in tests because the geometry was
   * correct at every instant; only the continuity was broken.
   *
   * Held in refs, these change what the next frame draws without ever
   * interrupting the clock that decides where things are.
   */
  const elapsedRef = useRef(0);
  const activeIdRef = useRef<string | null>(activePlanetId ?? null);
  const focusIdRef = useRef<string | null>(focusPlanetId ?? null);
  const pausedRef = useRef<boolean>(Boolean(paused));
  const lastInteractionRef = useRef(0);
  /**
   * Repaint on demand.
   *
   * The animating tiers redraw continuously and ignore this. The still tier
   * has no loop to piggyback on, so every interaction has to ask for its own
   * frame or the canvas never reflects what the user just did.
   */
  const repaintRef = useRef<(() => void) | null>(null);

  activeIdRef.current = activePlanetId ?? null;
  pausedRef.current = Boolean(paused);

  // Stars are generated once and reused: regenerating them per frame produces a
  // twitching field that reads as a rendering fault rather than a starscape.
  const starsRef = useRef<Star[]>([]);
  useEffect(() => {
    starsRef.current = makeStars(starCountFor(tier));
  }, [tier]);

  /*
   * A change of focus is an interaction, so the idle clock restarts with it.
   * Without that, focusing a planet after sitting still would begin easing the
   * camera home in the same breath as sending it in.
   */
  useEffect(() => {
    focusIdRef.current = focusPlanetId ?? null;
    lastInteractionRef.current = performance.now();
    if (!focusPlanetId) {
      motionRef.current = {
        ...motionRef.current,
        target: unfocusedTarget(motionRef.current.target),
      };
    }
    repaintRef.current?.();
  }, [focusPlanetId]);

  const notifyHover = useCallback(
    (planet: Planet | null) => {
      const id = planet?.id ?? null;
      if (hoveredRef.current === id) return;
      hoveredRef.current = id;
      onHoverPlanet?.(planet);
    },
    [onHoverPlanet],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let running = true;
    const startedAt = performance.now();
    lastInteractionRef.current = startedAt;
    let lastFrameAt = startedAt;
    // Frame-budget watch: a handful of slow frames means this machine cannot
    // carry the full scene, and the honest response is to draw less.
    let slowFrames = 0;
    let localTier = tier;

    /*
     * DEFECT LP-03, FIXED — the still tier drew nothing at all.
     *
     * Assigning `canvas.width` RESETS the canvas: it wipes every pixel and
     * every context setting, which is why the transform has to be reapplied
     * immediately below. `ResizeObserver` delivers its first callback after the
     * animation-frame callbacks of the same frame and before compositing, so
     * the order on load was: paint the whole scene, then blank it, then show
     * the blank one.
     *
     * On an animating tier the very next frame repainted and nobody ever saw
     * it. On the STILL tier there is no next frame — so every visitor with
     * `prefers-reduced-motion`, and every visitor on a low-powered device, was
     * shown an empty rectangle where the product's opening image should be.
     * The same held for any later resize: the scene vanished and never
     * returned.
     *
     * A resize now asks for a repaint, which the animating tiers ignore as a
     * duplicate frame and the still tier needs to survive its own setup.
     */
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // Capped at 2: a 3x phone display triples the fill cost for a difference
      // nobody can see on a gradient.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      repaintRef.current?.();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (now: number) => {
      if (!running) return;
      frame = 0;
      const delta = now - lastFrameAt;
      lastFrameAt = now;
      const paused = pausedRef.current;
      /*
       * The clock advances only when the scene is allowed to animate. On the
       * still tier the planets hold their positions, so a repaint triggered by
       * a drag redraws the same system from a new angle rather than jumping it
       * forward by however long the user sat still. That is the difference
       * between "reduced motion" and "motion in bursts".
       */
      if (!paused && localTier !== "static") elapsedRef.current += delta;

      if (localTier === "full" && delta > 34) {
        slowFrames += 1;
        if (slowFrames > 24) {
          localTier = "reduced";
          starsRef.current = starsRef.current.slice(0, starCountFor("reduced"));
        }
      } else if (delta < 24) {
        slowFrames = Math.max(0, slowFrames - 1);
      }

      /* ------------------------------------------------ camera motion --- */
      /*
       * The focus target is read from the PREVIOUS frame's positions, on
       * purpose. The pan the camera needs depends on where the planet projects,
       * which depends on the camera — projecting twice per frame to break that
       * circle would double the cost of the most expensive part of the scene to
       * remove one frame of lag from a value that is being eased over ~400ms
       * anyway. At 60fps the error is invisible; the cost would not be.
       */
      const focusId = focusIdRef.current;
      if (focusId) {
        const pan = focusPanFor(positionsRef.current, focusId);
        if (pan) {
          motionRef.current = {
            ...motionRef.current,
            target: clampCamera({ ...motionRef.current.target, ...pan, zoom: FOCUS_ZOOM }),
          };
        }
      }

      if (localTier === "static") {
        /*
         * Reduced motion gets no easing and no autonomous drift: the camera IS
         * the target. A spring is motion, and someone who asked for none should
         * not be given it as a courtesy — dragging still works, it simply
         * arrives where it was put.
         */
        motionRef.current = { ...motionRef.current, current: motionRef.current.target };
      } else {
        motionRef.current = stepCamera(
          motionRef.current,
          delta / 1000,
          now - lastInteractionRef.current,
        );
      }

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const aspect = w / Math.max(1, h);
      const t = elapsedRef.current / 1000;

      // The whole frame, in one call. Extracted to `lib/landing/paint` so the
      // drawing can be asserted in a test and invoked on a real canvas without
      // an animation frame — see the comment at the top of that module.
      const positions = paintUniverse(context, {
        width: w,
        height: h,
        time: t,
        camera: motionRef.current.current,
        tier: localTier,
        stars: starsRef.current,
        activePlanetId: activeIdRef.current,
      });
      positionsRef.current = positions;

      /* ------------------------------------------------- hit testing --- */
      const pointer = pointerRef.current;
      if (pointer && !draggingRef.current) {
        const hit = planetAtPointer(positions, pointer.x, pointer.y, aspect);
        notifyHover(hit?.planet ?? null);
        canvas.style.cursor = hit ? "pointer" : "grab";
      }

      /*
       * A still tier does not schedule the NEXT frame — it would burn battery
       * redrawing an identical image. It stays repaintable on demand, though:
       * `requestRepaint` below is called when the user drags, zooms or hovers.
       *
       * THE DEFECT THIS FIXES. The loop used to `return` here outright, which
       * ended it permanently. On any device that got the still tier — every
       * machine with `prefers-reduced-motion`, and every low-powered one — the
       * scene painted once and then ignored the mouse completely: dragging
       * rotated the camera in memory while the canvas never redrew, and hover
       * hit-testing stopped with it. The universe looked like a static image
       * with broken controls, to exactly the users least able to tell that it
       * was meant to move.
       *
       * Reduced motion means "do not move on your own", not "do not respond".
       */
      if (localTier === "static") return;
      frame = requestAnimationFrame(draw);
    };

    // Repaint once, soon, without stacking duplicate frames.
    const requestRepaint = () => {
      if (!running || frame !== 0) return;
      frame = requestAnimationFrame(draw);
    };
    repaintRef.current = requestRepaint;

    frame = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      repaintRef.current = null;
      observer.disconnect();
    };
    /*
     * `activePlanetId` and `paused` are deliberately NOT dependencies — they are
     * read through refs above. Listing them restarted the loop, and with it the
     * clock, every time the pointer crossed a planet. See `elapsedRef`.
     */
  }, [tier, notifyHover]);

  /* ------------------------------------------------------- interaction -- */

  const toLocal = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  /** Any deliberate act. Resets the clock that decides when to drift home. */
  const touched = () => {
    lastInteractionRef.current = performance.now();
  };

  return (
    <canvas
      ref={canvasRef}
      /*
       * Hidden from assistive technology on purpose. Everything it shows is
       * available as real buttons in the legend beside it; exposing a canvas
       * that announces nothing would add noise, not access.
       */
      aria-hidden
      className={className}
      /*
       * `userSelect: none` on the canvas is not enough on its own — a drag that
       * starts here and travels over the headings selects THEM, because
       * selection follows the pointer across elements once it has begun. The
       * whole document is locked for the duration of a drag in `onPointerDown`
       * below and released on the way out. Dragging the system must never leave
       * the page covered in highlighted text.
       */
      style={{ touchAction: "none", userSelect: "none", cursor: dragging ? "grabbing" : "grab" }}
      onPointerMove={(event) => {
        pointerRef.current = toLocal(event);
        const drag = draggingRef.current;
        if (!drag) {
          // Hover moved. On an animating tier the next frame picks this up on
          // its own; on the still tier nothing would ever redraw the highlight.
          repaintRef.current?.();
          return;
        }
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        const now = performance.now();
        // Guarded: two pointermove events can share a millisecond, and dividing
        // by that zero puts Infinity into the flick velocity, which sends the
        // camera to NaN and blanks the canvas with no error anywhere.
        const dt = Math.max(1, now - drag.at) / 1000;
        const yawPerPx = 0.005;
        const pitchPerPx = 0.004;
        draggingRef.current = {
          x: event.clientX,
          y: event.clientY,
          at: now,
          travelled: drag.travelled + Math.abs(dx) + Math.abs(dy),
          // Smoothed, because a single frame's delta is noisy enough that a
          // steady drag ending on one slow sample throws the release away.
          vx: drag.vx * 0.72 + ((dx * yawPerPx) / dt) * 0.28,
          vy: drag.vy * 0.72 + ((dy * pitchPerPx) / dt) * 0.28,
        };
        touched();
        motionRef.current = {
          ...motionRef.current,
          target: clampCamera({
            ...motionRef.current.target,
            yaw: motionRef.current.target.yaw + dx * yawPerPx,
            pitch: motionRef.current.target.pitch + dy * pitchPerPx,
          }),
          // A drag in progress overrides any glide still running from the last.
          yawVelocity: 0,
          pitchVelocity: 0,
        };
        repaintRef.current?.();
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        // Locked for the whole document, not just this element — see the style
        // note above. Released in `onPointerUp` and `onPointerLeave`, both of
        // which run even when the drag ends off the canvas.
        document.body.style.userSelect = "none";
        draggingRef.current = {
          x: event.clientX,
          y: event.clientY,
          at: performance.now(),
          travelled: 0,
          vx: 0,
          vy: 0,
        };
        touched();
        setDragging(true);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        document.body.style.userSelect = "";
        const drag = draggingRef.current;
        draggingRef.current = null;
        setDragging(false);
        touched();
        if (!drag) return;

        /*
         * A CLICK, NOT A DRAG. Below the slop threshold the pointer never
         * really moved, so this was a selection: settle the camera on whatever
         * is under it, or let go if that is empty space. Above it, the movement
         * was the point, and its velocity becomes a glide.
         */
        if (drag.travelled <= CLICK_SLOP_PX) {
          const rect = event.currentTarget.getBoundingClientRect();
          const aspect = rect.width / Math.max(1, rect.height);
          const hit = planetAtPointer(
            positionsRef.current,
            (event.clientX - rect.left) / rect.width,
            (event.clientY - rect.top) / rect.height,
            aspect,
          );
          onSelectPlanet?.(hit?.planet ?? null);
          repaintRef.current?.();
          return;
        }

        motionRef.current = {
          ...motionRef.current,
          yawVelocity: drag.vx,
          pitchVelocity: drag.vy,
        };
        repaintRef.current?.();
      }}
      onPointerLeave={() => {
        document.body.style.userSelect = "";
        pointerRef.current = null;
        draggingRef.current = null;
        setDragging(false);
        notifyHover(null);
        repaintRef.current?.();
      }}
      onDoubleClick={() => {
        // A way back. After spinning the system to an odd angle there is
        // otherwise no route to the framing the page was designed around,
        // short of reloading. Written to the TARGET, so the view sails back
        // rather than cutting.
        touched();
        onSelectPlanet?.(null);
        motionRef.current = {
          current: motionRef.current.current,
          target: { ...DEFAULT_CAMERA },
          yawVelocity: 0,
          pitchVelocity: 0,
        };
        repaintRef.current?.();
      }}
      onWheel={(event) => {
        // Not prevented: the page still scrolls. A canvas that swallows the
        // wheel traps a visitor who is trying to read what is below it.
        touched();
        motionRef.current = {
          ...motionRef.current,
          target: clampCamera({
            ...motionRef.current.target,
            distance: motionRef.current.target.distance + event.deltaY * 0.004,
          }),
        };
        repaintRef.current?.();
      }}
    />
  );
}
