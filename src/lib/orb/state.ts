/**
 * The OCADE orb: what it is doing, and what that looks like.
 *
 * ONE ORB, TEN STATES, AND NO SECOND OPINION
 * ------------------------------------------
 * The orb is the only thing on screen that tells a person what OCADE is doing
 * right now, and it has to be readable across a room, in the corner of an eye,
 * by somebody who has never read a word of documentation. That rules out
 * anything a legend would be needed for.
 *
 * So each state changes THREE things at once — luminance, motion and shape — and
 * changes them in the same direction. Nothing here is distinguished by hue
 * alone: a person with deuteranopia must be able to tell "acting" from
 * "listening", and the difference between those two is not only that one is
 * it has doubled in energy and drawn itself tight.
 *
 * WHY THIS MODULE HAS NO RENDERER IN IT
 * -------------------------------------
 * These are numbers, so they can be argued with. "Paused is calmer than
 * thinking" and "stopped genuinely stops" are assertions a test makes rather
 * than claims a comment makes. The renderer reads this; it decides nothing.
 */

export type OrbState =
  /** Nothing asked. The orb breathes. */
  | "idle"
  /** The microphone is open and OCADE is hearing the room. */
  | "listening"
  /** The instruction has landed and OCADE is deciding. Nothing is touched yet. */
  | "thinking"
  /** OCADE is talking, aloud or on screen. */
  | "speaking"
  /** OCADE is doing something to the machine right now. */
  | "acting"
  /**
   * OCADE is working inside a browser page rather than on the machine itself.
   *
   * SEPARATE FROM `acting` BECAUSE THE TWO ARE DIFFERENT RISKS. A person who
   * can see that OCADE is clicking inside a tab, rather than typing into
   * whatever window happens to be in front, knows how much of their computer
   * is in play — and that is exactly the judgement they need in the second
   * before deciding to take over.
   */
  | "browsing"
  /** A question is on screen and OCADE is waiting for a yes or a no. */
  | "approval"
  /** Held by the person. Everything keeps its place; it slows. */
  | "paused"
  /** The person has taken the controls back. OCADE is watching, not driving. */
  | "takeover"
  /** Stopped by the person. Motion ends where it was. */
  | "stopped"
  /** Something failed, and OCADE has not hidden it. */
  | "error";

export const ORB_STATES: readonly OrbState[] = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "acting",
  "browsing",
  "approval",
  "paused",
  "takeover",
  "stopped",
  "error",
];

/**
 * The palette, as the product defines it.
 *
 * Customer-facing OCADE is monochrome. States remain distinguishable through
 * their luminance, motion, scale, turbulence and always-present text rather
 * than a hue that would vanish for colour-blind users or in reduced-colour
 * environments.
 */
export interface OrbAppearance {
  /** Core colour, as `[r, g, b]` in 0–1. */
  core: readonly [number, number, number];
  /** Rim/halo colour, same range. */
  rim: readonly [number, number, number];
  /**
   * How much the orb is doing, 0–1.
   *
   * Drives every animated quantity together, so a state cannot be loud in one
   * dimension and quiet in another. `stopped` is exactly 0 and that is load-
   * bearing: the renderer treats 0 as "hold the last frame".
   */
  energy: number;
  /** Breaths per second at rest, before energy scales it. */
  pulseHz: number;
  /** Surface displacement, 0–1. Higher reads as agitated. */
  turbulence: number;
  /**
   * Radius as a fraction of the resting size.
   *
   * Contraction reads as concentration and expansion as openness, which is why
   * `listening` is the largest and `acting` the tightest.
   */
  scale: number;
  /** What a screen reader is told, and what a tooltip shows. */
  label: string;
}

function neutral(lightness: number): readonly [number, number, number] {
  return [lightness, lightness, lightness] as const;
}

const SILVER = neutral(0.86);
const BRIGHT = neutral(0.72);
const DEPTH = neutral(0.5);
const EMPHASIS = neutral(0.66);
const ASH = neutral(0.4);

export const ORB_APPEARANCE: Record<OrbState, OrbAppearance> = {
  idle: {
    core: SILVER,
    rim: DEPTH,
    energy: 0.18,
    pulseHz: 0.22,
    turbulence: 0.1,
    scale: 1,
    label: "Ready",
  },
  listening: {
    /*
     * The largest and the slowest. Listening is the one state where OCADE is
     * doing nothing and the person is doing everything, and an orb that got
     * busy while somebody was mid-sentence would read as impatience.
     */
    core: SILVER,
    rim: BRIGHT,
    energy: 0.42,
    pulseHz: 0.5,
    turbulence: 0.16,
    scale: 1.12,
    label: "Listening",
  },
  thinking: {
    core: DEPTH,
    rim: SILVER,
    energy: 0.6,
    pulseHz: 1.1,
    turbulence: 0.42,
    scale: 0.97,
    label: "Thinking",
  },
  speaking: {
    core: SILVER,
    rim: BRIGHT,
    energy: 0.55,
    pulseHz: 1.6,
    turbulence: 0.22,
    scale: 1.05,
    label: "Speaking",
  },
  acting: {
    /*
     * The tightest and the hottest. Something on the machine is changing, and
     * that is the moment a person is most likely to want to interrupt — so it
     * is the state that most clearly is not any of the others.
     */
    core: EMPHASIS,
    rim: BRIGHT,
    energy: 0.9,
    pulseHz: 2.1,
    turbulence: 0.55,
    scale: 0.92,
    label: "Working on your computer",
  },
  browsing: {
    /*
     * Busy like `acting`, and shaped differently: a page is a bounded place, so
     * the orb stays open rather than drawing itself tight. Same energy family,
     * distinct silhouette — readable without colour, which is the rule the
     * whole table is built on.
     */
    core: DEPTH,
    rim: BRIGHT,
    energy: 0.82,
    pulseHz: 1.9,
    turbulence: 0.48,
    scale: 1.03,
    label: "Working in the browser",
  },
  approval: {
    /*
     * Bright through and through, and slow. A question does not need urgency; it
     * needs to be impossible to miss and comfortable to sit with while the
     * person reads what they are agreeing to.
     */
    core: BRIGHT,
    rim: BRIGHT,
    energy: 0.5,
    pulseHz: 0.75,
    turbulence: 0.12,
    scale: 1.08,
    label: "Waiting for you",
  },
  paused: {
    core: ASH,
    rim: SILVER,
    energy: 0.12,
    pulseHz: 0.15,
    turbulence: 0.05,
    scale: 0.98,
    label: "Paused",
  },
  takeover: {
    /*
     * Deliberately close to `paused` and deliberately not the same. The person
     * has the controls; OCADE is present and not acting. A brighter rim than
     * ash says "still here" without saying "about to move".
     */
    core: ASH,
    rim: DEPTH,
    energy: 0.2,
    pulseHz: 0.3,
    turbulence: 0.08,
    scale: 0.95,
    label: "You have the controls",
  },
  stopped: {
    core: ASH,
    rim: ASH,
    energy: 0,
    pulseHz: 0,
    turbulence: 0,
    scale: 0.9,
    label: "Stopped",
  },
  error: {
    core: EMPHASIS,
    rim: EMPHASIS,
    energy: 0.35,
    pulseHz: 0.4,
    turbulence: 0.3,
    scale: 1,
    label: "Something went wrong",
  },
};

/**
 * How the orb is drawn on this device.
 *
 * `full` is the raymarched sphere. `simple` is a painted gradient with the same
 * palette and the same pulse — visually the same object, an order of magnitude
 * cheaper. `still` is one frame that never updates.
 *
 * A weak GPU gets `simple`, not `still`: the state readout is the orb's whole
 * job, and freezing it would take the information away to save power the device
 * was not short of. Only an explicit reduced-motion preference stops the motion,
 * because that is a person asking rather than a heuristic guessing.
 */
export type OrbQuality = "full" | "simple" | "still";

export interface OrbEnvironment {
  reducedMotion: boolean;
  /** False when no usable WebGL context could be created. */
  webglAvailable: boolean;
  /** From the device assessment: few cores, little memory, or data saver on. */
  lowEndDevice: boolean;
  /** True below the mobile breakpoint. */
  smallViewport: boolean;
}

export function qualityFor(environment: OrbEnvironment): OrbQuality {
  if (environment.reducedMotion) return "still";
  if (!environment.webglAvailable) return "simple";
  if (environment.lowEndDevice) return "simple";
  /*
   * A small viewport is not, on its own, a slow device — a recent phone
   * outruns a five-year-old laptop. What a small viewport does mean is that
   * the orb is drawn small, where the raymarched detail is invisible, so the
   * cheaper renderer costs the person nothing they could see.
   */
  if (environment.smallViewport) return "simple";
  return "full";
}

/**
 * The orb's appearance at a moment in time.
 *
 * Pure, so the motion can be tested without a canvas or a clock. `seconds` is
 * elapsed time in the current state; `amplitude` is live input level (0–1),
 * used only while listening or speaking, where the orb should answer the room
 * rather than a timer.
 */
export interface OrbFrame {
  core: readonly [number, number, number];
  rim: readonly [number, number, number];
  /** Final radius multiplier, breathing included. */
  radius: number;
  /** Surface displacement for this frame, 0–1. */
  turbulence: number;
  /** Halo strength, 0–1. */
  glow: number;
  label: string;
}

export function orbFrameAt(
  state: OrbState,
  seconds: number,
  options: { amplitude?: number; quality?: OrbQuality } = {},
): OrbFrame {
  const look = ORB_APPEARANCE[state];
  const quality = options.quality ?? "full";

  /*
   * A still orb is the resting shape, not a frozen mid-breath one. Catching a
   * pulse at its peak and holding it there forever reads as a rendering bug.
   */
  if (quality === "still" || look.energy === 0) {
    return {
      core: look.core,
      rim: look.rim,
      radius: look.scale,
      turbulence: 0,
      glow: look.energy * 0.5,
      label: look.label,
    };
  }

  const amplitude = clamp01(options.amplitude ?? 0);
  const listens = state === "listening" || state === "speaking";
  /*
   * Live input takes over from the timer while listening or speaking, because
   * an orb that pulses on a clock during speech is a decoration and one that
   * pulses on the voice is an instrument. It is blended rather than switched:
   * silence must still breathe, or the orb looks dead mid-pause.
   */
  const drive = listens ? Math.max(look.energy * 0.45, amplitude) : look.energy;

  const breath = Math.sin(seconds * look.pulseHz * Math.PI * 2);
  const radius = look.scale * (1 + breath * 0.06 * drive);
  const turbulence = look.turbulence * (0.7 + 0.3 * (breath * 0.5 + 0.5));
  const glow = clamp01(drive * (0.55 + 0.45 * (breath * 0.5 + 0.5)));

  return { core: look.core, rim: look.rim, radius, turbulence, glow, label: look.label };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * The orb state for what the runtime is doing.
 *
 * Cowork reports nine internal phases and Chat reports its own; both map here
 * so the orb never has two vocabularies. `observing` becomes `thinking` rather
 * than `acting` on purpose: reading the screen changes nothing, and the
 * stronger motion treatment is reserved for the side-effecting half of the loop.
 */
export function orbStateFor(input: {
  phase?: string | null;
  awaitingApproval?: boolean;
  userHasControl?: boolean;
  /**
   * True while the action in flight is happening inside a browser page.
   *
   * Read from the tool being run, not guessed from the sentence: only the
   * caller knows which adapter took the last step.
   */
  inBrowser?: boolean;
}): OrbState {
  if (input.awaitingApproval) return "approval";
  if (input.userHasControl) return "takeover";
  switch (input.phase) {
    case "listening":
      return "listening";
    case "thinking":
    case "observing":
      return "thinking";
    case "speaking":
      return "speaking";
    case "controlling":
    case "acting":
      return input.inBrowser ? "browsing" : "acting";
    case "paused":
      return "paused";
    case "stopped":
      return "stopped";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

/* ------------------------------------------------------------- accents -- */

/**
 * The orb's accent, and the one surface allowed to choose it.
 *
 * CUSTOMER-FACING OCADE IS MONOCHROME, and `silver` is that: the identity
 * tint, applied everywhere, which changes nothing. Jarvis is the single
 * expressive surface `docs/DESIGN.md` allows, so it — and only it — may offer
 * the others, from a curated list rather than a colour editor.
 *
 * AN ACCENT TINTS AND NOTHING ELSE. Energy, pulse, turbulence, scale and the
 * label are untouched by every accent, which is what keeps the orb readable
 * for somebody who cannot see the difference between them: the state is still
 * carried by motion, size and words, exactly as it is in the grey product.
 */
export type OrbAccent = "silver" | "ember" | "tide" | "moss";

export const ORB_ACCENTS: readonly OrbAccent[] = ["silver", "ember", "tide", "moss"];

/** What the picker calls each one. Plain words, no hex, no jargon. */
export const ORB_ACCENT_LABELS: Record<OrbAccent, string> = {
  silver: "Silver",
  ember: "Ember",
  tide: "Tide",
  moss: "Moss",
};

/**
 * Channel weights, normalised so the tint cannot change how bright the orb is.
 *
 * The weights average to 1, so a grey of 0.72 stays a colour whose mean is
 * 0.72. Without that an accent would double as a brightness control, and two
 * states that differ by luminance — which is most of the table — would stop
 * being told apart on a tinted orb.
 */
const ACCENT_WEIGHTS: Record<OrbAccent, readonly [number, number, number]> = {
  silver: [1, 1, 1],
  ember: [1.24, 0.94, 0.82],
  tide: [0.82, 1.02, 1.16],
  moss: [0.86, 1.14, 0.9],
};

function tintColour(
  colour: readonly [number, number, number],
  accent: OrbAccent,
): readonly [number, number, number] {
  const weights = ACCENT_WEIGHTS[accent];
  return [
    clamp01(colour[0] * weights[0]),
    clamp01(colour[1] * weights[1]),
    clamp01(colour[2] * weights[2]),
  ] as const;
}

/** The same frame, in the chosen accent. `silver` returns it unchanged. */
export function tintFrame(frame: OrbFrame, accent: OrbAccent): OrbFrame {
  if (accent === "silver") return frame;
  return { ...frame, core: tintColour(frame.core, accent), rim: tintColour(frame.rim, accent) };
}
