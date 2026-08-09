import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAppearance } from "../use-appearance";
import { chooseRenderTier } from "../landing/universe";
import {
  createRevealController,
  motionAllowed,
  staggerDelay,
  REVEAL_CLASS,
  type RevealController,
  type RevealOptions,
} from "./reveal";

/**
 * Scroll reveal for any part of the application.
 *
 * Usage is one ref on each element that should rise into view:
 *
 *   const reveal = useReveal();
 *   <section {...reveal.props(0)}>…</section>
 *   <section {...reveal.props(1)}>…</section>
 *
 * The index is the stagger position. Everything else — whether motion is
 * allowed at all, whether this device can carry it, cleanup — is handled here,
 * so no caller can produce the stranded-invisible-content failure by forgetting
 * a branch. See `reveal.ts` for why that failure drives the whole design.
 */
export function useReveal(options: RevealOptions = {}) {
  const { reducedMotion, osReducedMotion } = useAppearance();

  // Measured once. The tier depends on hardware, which does not change while
  // the page is open, and re-measuring per render would rebuild the observer.
  const tier = useMemo(() => {
    if (typeof window === "undefined") return "static" as const;
    const nav = navigator as Navigator & { deviceMemory?: number };
    return chooseRenderTier({
      reducedMotion: reducedMotion || osReducedMotion,
      cores: nav.hardwareConcurrency,
      memoryGb: nav.deviceMemory,
      viewportWidth: window.innerWidth,
    });
  }, [reducedMotion, osReducedMotion]);

  const enabled = motionAllowed({
    reducedMotion,
    osReducedMotion,
    tier,
    hasDom: typeof window !== "undefined",
  });

  const controllerRef = useRef<RevealController | null>(null);
  const optionsKey = JSON.stringify(options);

  useEffect(() => {
    const controller = createRevealController(enabled, JSON.parse(optionsKey) as RevealOptions);
    controllerRef.current = controller;
    return () => {
      // Reveals anything still hidden before tearing down — see `disconnect`.
      controller.disconnect();
      controllerRef.current = null;
    };
  }, [enabled, optionsKey]);

  const ref = useCallback((element: HTMLElement | null) => {
    controllerRef.current?.observe(element);
  }, []);

  const props = useCallback(
    (index = 0) => ({
      ref,
      className: REVEAL_CLASS,
      // Inline because the value is per-element and a Tailwind class cannot be
      // generated from a runtime number.
      style: { "--reveal-delay": `${staggerDelay(index)}ms` } as React.CSSProperties,
    }),
    [ref],
  );

  return useMemo(() => ({ ref, props, enabled }), [ref, props, enabled]);
}
