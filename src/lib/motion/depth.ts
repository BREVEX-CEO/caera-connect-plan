/**
 * The application's third dimension.
 *
 * WHAT THIS IS. OCADE's surfaces sit at real depths in a perspective scene
 * rather than being stacked flat with shadows painted on. A panel nearer the
 * viewer is nearer: it occludes correctly, it parallaxes against the panels
 * behind it as the pointer moves, and its elevation is a coordinate rather than
 * a `box-shadow` chosen by eye.
 *
 * WHY CSS 3D TRANSFORMS AND NOT WEBGL — the same argument `UniverseCanvas`
 * makes for its scene, but with a harder constraint. The interface is not a
 * picture of an interface: every panel contains real buttons, real inputs and
 * real text that must stay focusable, selectable, readable by a screen reader
 * and findable by browser search. Rendering the workspace into a WebGL context
 * throws all of that away and would have to rebuild it badly. With CSS 3D the
 * DOM *is* the scene — the browser composites real elements on the GPU, and
 * every control keeps working exactly as it did in two dimensions.
 *
 * It also costs no dependency, which matters here: this product must install
 * and run with no network, and a 3D engine pulled from a CDN would be the one
 * import that breaks that.
 *
 * EVERYTHING IS A PURE FUNCTION OF INPUTS. No DOM, no globals, no time source.
 * The geometry can be reasoned about and tested without a browser, which is the
 * same split `universe.ts` makes between the scene and its renderer.
 */

import type { RenderTier } from "../landing/universe";

/**
 * Named depths, in pixels along Z.
 *
 * A SCALE, NOT A PALETTE OF SHADOWS. Six levels, each roughly 1.6× the last, so
 * two adjacent surfaces are distinguishable without the far ones flying off.
 * The numbers are small on purpose: at the 1400px perspective below, 48px of Z
 * is a visible but calm separation, while the 200px+ values people reach for
 * first produce a scene that lurches when the pointer moves an inch.
 *
 * `base` is exactly 0 — the resting plane the page has always occupied — so a
 * surface that opts out of depth is not subtly displaced relative to one that
 * opts in.
 */
export const DEPTH = {
  /** The page itself. */
  base: 0,
  /** Ordinary content panels. */
  raised: 12,
  /** Panels the eye should reach first: primary cards, active items. */
  elevated: 24,
  /** Chrome that floats over content: sidebars, headers, composers. */
  floating: 40,
  /** Transient surfaces: popovers, menus, tooltips. */
  overlay: 64,
  /** Modal dialogue, above everything. */
  modal: 96,
} as const;

export type DepthLevel = keyof typeof DEPTH;

/**
 * Camera distance for the scene, in pixels.
 *
 * Larger is a longer lens: less distortion, less drama. 1400 keeps a
 * 1280px-wide workspace looking like a room rather than a fisheye — at the 800
 * that reads well on a single hero card, panels at the edges of a full-width
 * application shear noticeably, which is distracting to work inside.
 */
export const SCENE_PERSPECTIVE = 1400;

/**
 * The most a surface may tilt, in degrees.
 *
 * DELIBERATELY SMALL. Tilt exists to make depth legible when the pointer moves,
 * not to be noticed on its own. Past about 4° the text on a panel starts to
 * lose its baseline and long paragraphs become measurably harder to read; this
 * is an application people work inside for hours, not a landing page.
 */
export const MAX_TILT_DEGREES = 3.5;

/** How much of the pointer's travel a surface's parallax follows, per level. */
const PARALLAX_PER_PX = 0.06;

export interface Tilt {
  /** Rotation about X, in degrees. Positive tips the top away from the viewer. */
  rotateX: number;
  /** Rotation about Y, in degrees. Positive turns the right edge away. */
  rotateY: number;
  /** Horizontal parallax offset, in pixels. */
  translateX: number;
  /** Vertical parallax offset, in pixels. */
  translateY: number;
}

export const FLAT: Tilt = { rotateX: 0, rotateY: 0, translateX: 0, translateY: 0 };

/** Clamp to [-1, 1]; NaN becomes 0 rather than propagating through the scene. */
function unit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

/**
 * Collapse negative zero to zero.
 *
 * `-x * k` yields `-0` when x is 0, which is arithmetically identical and
 * textually not: the transform string comes out `rotateY(-0.00deg)`. Harmless
 * to render, but it makes a resting surface and a resting surface differ under
 * comparison, so a snapshot or an equality check on the rest state fails for a
 * sign that carries no meaning.
 */
function zeroed(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * Where a surface should sit, given the pointer.
 *
 * `pointerX`/`pointerY` are normalised to [-1, 1] with 0 at the centre of the
 * scene — screen coordinates never reach this function, so it does not need to
 * know about viewports, scrolling or device pixel ratios.
 *
 * DEEPER SURFACES MOVE LESS. That is the whole illusion: parallax scales with
 * distance from the camera, so chrome floating at `overlay` swings further
 * across the pointer's travel than content sitting at `raised`. Inverting that
 * relationship — which is easy to do by accident — reads as the scene turning
 * inside out.
 *
 * TILT IS INVERTED RELATIVE TO THE POINTER, and that is not a sign error. A
 * pointer to the right of centre should push the right edge AWAY, as though the
 * surface were being pressed; following the pointer instead makes panels appear
 * to flee the cursor.
 */
export function tiltFor(
  level: DepthLevel,
  pointerX: number,
  pointerY: number,
  intensity = 1,
): Tilt {
  const x = unit(pointerX);
  const y = unit(pointerY);
  const strength = Math.max(0, Math.min(1, Number.isFinite(intensity) ? intensity : 0));
  const z = DEPTH[level];

  return {
    rotateX: zeroed(y * MAX_TILT_DEGREES * strength),
    rotateY: zeroed(-x * MAX_TILT_DEGREES * strength),
    translateX: zeroed(x * z * PARALLAX_PER_PX * strength),
    translateY: zeroed(y * z * PARALLAX_PER_PX * strength),
  };
}

/**
 * The CSS `transform` for a surface at a depth, with a tilt applied.
 *
 * ORDER IS LOAD-BEARING. CSS applies transforms left to right in the element's
 * own coordinate space, so the translate must come before the rotations: put
 * the rotation first and the translation happens along the ROTATED axes, which
 * makes a tilted panel drift sideways as it turns instead of parallaxing
 * cleanly. `translate3d` rather than `translateX`/`Y`/`Z` so the whole thing is
 * one composited operation.
 */
export function transformFor(level: DepthLevel, tilt: Tilt = FLAT): string {
  const z = DEPTH[level];
  return (
    `translate3d(${tilt.translateX.toFixed(2)}px, ${tilt.translateY.toFixed(2)}px, ${z}px) ` +
    `rotateX(${tilt.rotateX.toFixed(2)}deg) rotateY(${tilt.rotateY.toFixed(2)}deg)`
  );
}

/**
 * How much depth this device and this person should get.
 *
 * THREE STATES, NOT A TOGGLE.
 *
 *  - `full`     — depth and pointer-driven tilt.
 *  - `static`   — depth WITHOUT tilt. Surfaces keep their Z positions, so the
 *                 layering, occlusion and shadow relationships all survive;
 *                 nothing moves in response to the pointer.
 *  - `flat`     — no transforms at all. The two-dimensional layout, unchanged.
 *
 * REDUCED MOTION GOES ALL THE WAY TO `flat`. A still 3D scene technically has
 * no animation in it, but it is still a perspective projection: text sits on
 * tilted planes, shadows imply movement that is not coming, and for the people
 * who set this preference because motion and simulated depth make them unwell
 * that is the wrong answer. So `prefers-reduced-motion`, or the in-app switch,
 * removes the third dimension entirely and the interface returns to the plain
 * two-dimensional layout.
 *
 * NOTHING IS LOST BUT THE EFFECT. `flat` changes transforms only — every
 * panel keeps its border, its background, its contrast, its focus ring, its
 * size and its position in the reading order. A reduced-motion interface must
 * be the same product, held still.
 *
 * `static` remains for the capability case: a machine that should not run a
 * continuous animation but has no objection to depth.
 */
export type DepthMode = "full" | "static" | "flat";

export function depthMode(input: {
  reducedMotion: boolean;
  osReducedMotion: boolean;
  tier: RenderTier;
  hasDom: boolean;
  /** False when the browser cannot do 3D transforms; then nothing is drawn. */
  supports3d?: boolean;
  /**
   * The person's own choice, from Settings > Appearance. Omitted means on, so
   * every existing caller and every account predating the setting keeps depth.
   */
  userDepth3d?: boolean;
}): DepthMode {
  if (!input.hasDom) return "flat";
  if (input.supports3d === false) return "flat";
  if (input.userDepth3d === false) return "flat";
  // Either source of the preference is the person asking; neither outranks the
  // other, and both mean the same thing here.
  if (input.reducedMotion || input.osReducedMotion) return "flat";
  // The tier is measured from cores, memory and viewport. "static" there means
  // this machine should not be running a continuous animation.
  if (input.tier === "static") return "static";
  return input.tier === "reduced" ? "static" : "full";
}

/**
 * Normalise a pointer position within a rectangle to [-1, 1].
 *
 * A zero-sized rectangle returns the centre rather than dividing by zero — an
 * element that has not been laid out yet is a real state during the first
 * frame, and `NaN` in a transform silently removes the element from the scene.
 */
export function normalisePointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: unit(((clientX - rect.left) / rect.width) * 2 - 1),
    y: unit(((clientY - rect.top) / rect.height) * 2 - 1),
  };
}
