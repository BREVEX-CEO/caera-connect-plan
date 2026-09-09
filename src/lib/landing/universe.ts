/**
 * The OCADE universe: eight capabilities, and the opening that introduces them.
 *
 * EVERY PLANET IS A REAL CAPABILITY WITH A REAL BENEFIT. A decorative sphere
 * labelled "Innovation" is the thing this file exists to avoid: each entry
 * names something OCADE does and what it saves the person doing it, and the
 * benefit lines are the ones the product can actually keep.
 *
 * WHAT LEFT, AND WHY. This also held a complete 2D scene: orbit projection,
 * camera framing, flick physics and pointer hit testing, all pure functions of
 * time and pointer position. They served `landing/paint.ts`, a canvas renderer
 * the product stopped using when the hero became the Three.js scene in
 * `solar-scene.ts` — which carries its own bodies in `solar-data.ts`. Nothing
 * imported either the painter or the maths any more, so five hundred lines of
 * geometry and seventy tests were guarding a scene no visitor could reach.
 * `PLAN.md` Phase 1 removed them: a second answer to "where is the third
 * planet" is worse than no answer, because the tests make it look maintained.
 */

export interface Planet {
  id: string;
  name: string;
  /** The concrete benefit. Shown on hover and focus. Never decorative. */
  benefit: string;
  /** Orbit radius, in scene units where the core is 1. */
  orbit: number;
  /** Radians per second. Negative orbits retrograde, for visual variety. */
  speed: number;
  /** Starting angle, so the eight do not line up at t=0. */
  phase: number;
  /** Planet radius in scene units. */
  size: number;
  /** Orbit inclination in radians — what makes it a system, not a dial. */
  tilt: number;
  /** oklch triple, matching the app's accent tokens. */
  hue: number;
  /**
   * Axial rotation, radians per second.
   *
   * SEPARATE FROM `speed`, because a real body's day has nothing to do with its
   * year, and tying them together is what makes an orbit diagram read as a
   * clock face. These are all much faster than the orbital rates: a planet that
   * turned as slowly as it orbits would show no rotation at all at the scale it
   * is drawn, which is the same as not having implemented it.
   *
   * Signs vary. Two of the eight turn retrograde, which is both true of the
   * real system and the detail that stops eight spheres looking like one sphere
   * drawn eight times.
   */
  spin: number;
  /**
   * How far the body's own axis leans, radians.
   *
   * Tips the surface banding so the poles are not always dead centre. Small
   * values only — a planet on its side reads as a rendering fault.
   */
  axialTilt: number;
  /**
   * How much atmosphere this body has, 0–1.
   *
   * Drives the width and strength of the rim glow. Varied per planet so the
   * eight are distinguishable by silhouette as well as by hue — a thick, hazy
   * body next to a hard-edged rocky one is what makes the set read as a system
   * of different worlds rather than a palette.
   */
  atmosphere: number;
}

/**
 * Eight, and only eight.
 *
 * The count is fixed because the composition depends on it: eight orbits at
 * these radii fill the frame without crowding, and a ninth would either
 * overlap or push the outermost off screen on a laptop.
 */
export const PLANETS: Planet[] = [
  {
    id: "chat",
    name: "Chat",
    benefit:
      "Ask anything. OCADE generates replies on this device, subject to local engine support.",
    orbit: 1.9,
    speed: 0.132,
    phase: 0,
    size: 0.2,
    tilt: 0.06,
    hue: 88,
    spin: 0.62,
    axialTilt: 0.1,
    atmosphere: 0.55,
  },
  {
    id: "files",
    name: "Files",
    benefit: "Attach a 200-page report. OCADE searches it and reads only the parts that matter.",
    orbit: 2.5,
    speed: 0.104,
    phase: 0.9,
    size: 0.17,
    tilt: -0.13,
    hue: 152,
    spin: -0.44,
    axialTilt: 0.22,
    atmosphere: 0.3,
  },
  {
    id: "vision",
    name: "Vision",
    benefit:
      "Drop in a screenshot. OCADE reads it on-device when a supported local vision model is ready.",
    orbit: 3.1,
    speed: -0.086,
    phase: 1.9,
    size: 0.15,
    tilt: 0.19,
    hue: 232,
    spin: 0.78,
    axialTilt: 0.06,
    atmosphere: 0.72,
  },
  {
    id: "links",
    name: "Links",
    benefit: "Capture a page once, and keep reading it after the connection is gone.",
    orbit: 3.7,
    speed: 0.072,
    phase: 2.7,
    size: 0.16,
    tilt: -0.08,
    hue: 268,
    spin: 0.51,
    axialTilt: 0.28,
    atmosphere: 0.24,
  },
  {
    id: "voice",
    name: "Voice",
    benefit: "Speak instead of typing — in Hindi, Tamil, English and more, if your device can.",
    orbit: 4.3,
    speed: -0.061,
    phase: 3.6,
    size: 0.14,
    tilt: 0.24,
    hue: 12,
    spin: 0.86,
    axialTilt: 0.14,
    atmosphere: 0.62,
  },
  {
    id: "projects",
    name: "Projects",
    benefit: "Group conversations and files so context follows the work, not the tab.",
    orbit: 4.9,
    speed: 0.053,
    phase: 4.4,
    size: 0.18,
    tilt: -0.17,
    hue: 42,
    spin: -0.37,
    axialTilt: 0.19,
    atmosphere: 0.4,
  },
  {
    id: "offline",
    name: "Offline intelligence",
    benefit:
      "Download a supported local engine for offline work; sign-in, private sync and live web still need a network.",
    orbit: 5.6,
    speed: -0.045,
    phase: 5.2,
    size: 0.21,
    tilt: 0.11,
    hue: 188,
    spin: 0.29,
    axialTilt: 0.33,
    atmosphere: 0.85,
  },
  {
    id: "automations",
    name: "Automations",
    benefit: "Repeat work on a schedule, with a preview and a stop button before anything runs.",
    orbit: 6.3,
    speed: 0.038,
    phase: 6.0,
    size: 0.16,
    tilt: -0.22,
    hue: 320,
    spin: 0.68,
    axialTilt: 0.08,
    atmosphere: 0.36,
  },
];

export const INTRO_SEEN_KEY = "caera:landing:intro:v1";

export type IntroPhase =
  /** "CARCC CADANE" resolving out of the dark. */
  | "wordmark"
  /** The planned launch date beneath it. */
  | "established"
  /** The system ignites and the camera pulls back. */
  | "ignition"
  /** Ambient orbit. The steady state, and where a returning visitor starts. */
  | "ambient";

/** Milliseconds from the start of the intro at which each phase begins. */
export const INTRO_TIMELINE: Record<IntroPhase, number> = {
  wordmark: 0,
  established: 1400,
  ignition: 2900,
  ambient: 5200,
};

export function introPhaseAt(elapsedMs: number): IntroPhase {
  if (elapsedMs >= INTRO_TIMELINE.ambient) return "ambient";
  if (elapsedMs >= INTRO_TIMELINE.ignition) return "ignition";
  if (elapsedMs >= INTRO_TIMELINE.established) return "established";
  return "wordmark";
}

/**
 * Has this browser already watched the opening?
 *
 * Once per device, remembered in `localStorage`. A cinematic that replays on
 * every visit stops being cinematic by the third time and starts being an
 * obstacle between someone and the button they came to press — which is also
 * why the actions stay visible THROUGH the intro rather than after it.
 */
export function introSeen(storage?: Pick<Storage, "getItem">): boolean {
  const store = storage ?? safeLocal();
  try {
    return store?.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markIntroSeen(storage?: Pick<Storage, "setItem">): void {
  const store = storage ?? safeLocal();
  try {
    store?.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* Private browsing. The intro replays next visit, which is acceptable. */
  }
}

export function forgetIntro(storage?: Pick<Storage, "removeItem">): void {
  const store = storage ?? safeLocal();
  try {
    store?.removeItem(INTRO_SEEN_KEY);
  } catch {
    /* nothing to forget if storage is unavailable */
  }
}

function safeLocal(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/* --------------------------------------------------------- quality tiers -- */

/*
 * Re-exported, not redefined. `DepthScene` imports these from
 * `render-tier.ts` directly so that mounting it does not pull this module in;
 * everything that already needs the solar system keeps reading them from here.
 */
export { chooseRenderTier, starCountFor, type RenderTier } from "./render-tier";
