import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppearance } from "@/lib/use-appearance";
import { chooseRenderTier } from "@/lib/landing/universe";
import { depthMode, normalisePointer, type DepthMode } from "@/lib/motion/depth";
import { DepthContext, type DepthContextValue } from "./depth-context";

/**
 * The camera the whole application is seen through.
 *
 * ONE SCENE, ONE POINTER LISTENER. Every surface in the product reads its tilt
 * from here rather than attaching its own `pointermove`. That is not a
 * micro-optimisation: a workspace route renders forty-odd panels, and forty
 * listeners each doing their own `getBoundingClientRect` on every mouse event
 * is a layout thrash that turns the depth effect into the reason the app feels
 * slow. The scene measures once per frame and publishes two numbers.
 *
 * THE POINTER IS PUBLISHED AS CSS VARIABLES, not as React state. Re-rendering
 * the tree on pointer movement would be the same mistake one level up — it
 * would run every panel's render function at pointer rate. `--pointer-x` and
 * `--pointer-y` inherit to every descendant, so the browser recomputes the
 * transforms on the compositor and React does no work at all while the pointer
 * moves.
 *
 * WRITTEN TO `document.documentElement`, NOT TO A WRAPPER, and that is not
 * incidental. Dialogs, popovers, menus and tooltips all render through a React
 * PORTAL into `document.body` — outside this component's subtree entirely. A
 * wrapper div would leave every one of them with `--depth-active` unset, so the
 * surfaces that most need to read as "in front" would be the only ones with no
 * depth at all. The document element is the one ancestor everything shares.
 *
 * The component still renders `display: contents`, so it disturbs no layout —
 * the same reason `MotionScope` renders no box of its own.
 */

/** Does this browser composite 3D transforms? */
function supports3d(): boolean {
  if (typeof window === "undefined" || typeof CSS === "undefined" || !CSS.supports) return false;
  return CSS.supports("transform-style", "preserve-3d") && CSS.supports("perspective", "1000px");
}

export function DepthScene({ children }: { children: ReactNode }) {
  const { reducedMotion, osReducedMotion } = useAppearance();
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);

  /*
   * Measured once, on the client only.
   *
   * `mode` starts "flat" and is raised after mount, which also makes the server
   * render and the first client render agree: the tier depends on hardware the
   * server cannot see, so computing it during render would be a hydration
   * mismatch on every page.
   */
  const [mode, setMode] = useState<DepthMode>("flat");

  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    setMode(
      depthMode({
        reducedMotion,
        osReducedMotion,
        tier: chooseRenderTier({
          reducedMotion: reducedMotion || osReducedMotion,
          cores: nav.hardwareConcurrency,
          memoryGb: nav.deviceMemory,
          viewportWidth: window.innerWidth,
        }),
        hasDom: true,
        supports3d: supports3d(),
      }),
    );
  }, [reducedMotion, osReducedMotion]);

  const interactive = mode === "full";

  /*
   * The mode lives on the document element so portalled surfaces — dialogs,
   * menus, tooltips — are inside the scene too. Removed on unmount rather than
   * left behind: a stale `data-depth-scene="full"` on a page that no longer has
   * a scene would keep every depth rule active with nothing publishing a
   * pointer, freezing the interface at whatever angle it last held.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-depth-scene", mode);
    return () => root.removeAttribute("data-depth-scene");
  }, [mode]);

  const publish = useCallback(() => {
    frameRef.current = null;
    const next = pendingRef.current;
    if (!next) return;
    const root = document.documentElement;
    root.style.setProperty("--pointer-x", next.x.toFixed(3));
    root.style.setProperty("--pointer-y", next.y.toFixed(3));
  }, []);

  useEffect(() => {
    if (!interactive) return;

    const onMove = (event: PointerEvent) => {
      /*
       * A TOUCH IS NOT A HOVER. On a phone the only pointer events arrive
       * mid-gesture, so following them tilts the interface while somebody is
       * trying to scroll it — the content moves under the finger that is
       * moving it. Mouse and pen only.
       */
      if (event.pointerType === "touch") return;
      pendingRef.current = normalisePointer(event.clientX, event.clientY, {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      });
      // Coalesced to one write per frame. Pointer events fire far faster than
      // the display refreshes, and every extra write is a style recalculation
      // for nothing.
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(publish);
    };

    /*
     * The pointer leaving the window must return the scene to rest. Without
     * this the interface stays frozen at whatever angle it held when the cursor
     * crossed the edge, which reads as a rendering fault rather than a pose.
     */
    const onLeave = () => {
      pendingRef.current = { x: 0, y: 0 };
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(publish);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [interactive, publish]);

  /*
   * Reset to rest whenever tilt is switched off, so a scene that was mid-tilt
   * when the user turned on reduced motion does not stay leaning.
   */
  useEffect(() => {
    if (interactive) return;
    const root = document.documentElement;
    root.style.setProperty("--pointer-x", "0");
    root.style.setProperty("--pointer-y", "0");
  }, [interactive]);

  const value = useMemo<DepthContextValue>(
    () => ({ mode, enabled: mode !== "flat", interactive }),
    [mode, interactive],
  );

  return (
    <DepthContext.Provider value={value}>
      <div ref={hostRef} style={{ display: "contents" }}>
        {children}
      </div>
    </DepthContext.Provider>
  );
}
