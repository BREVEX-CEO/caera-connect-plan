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
 * So each state changes THREE things at once — colour, motion and shape — and
 * changes them in the same direction. Nothing here is distinguished by hue
 * alone: a person with deuteranopia must be able to tell "acting" from
 * "listening", and the difference between those two is not only that one is
 * crimson, it is that one has doubled in energy and drawn itself tight.
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
  "approval",
  "paused",
  "takeover",
  "stopped",
  "error",
];

/**
 * The palette, as the brand defines it.
 *
 * Silver is the resting identity. Gold is attention wanted FROM the person.
 * Aubergine is OCADE working on its own. Crimson is the machine being changed,
 * and error. There is no green: "everything is fine" is what the orb says by
 * being calm, not by turning a colour, and a green light is a thing people
 * learn to stop seeing.
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

const SILVER = [0.82, 0.84, 0.88] as const;
const GOLD = [0.87, 0.68, 0.31] as const;
const AUBERGINE = [0.45, 0.25, 0.55] as const;
const CRIMSON = [0.72, 0.19, 0.31] as const;
const ASH = [0.38, 0.39, 0.42] as const;

export const ORB_APPEARANCE: Record<OrbState, OrbAppearance> = {
  idle: {
    core: SILVER,
    rim: AUBERGINE,
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
    rim: GOLD,
    energy: 0.42,
    pulseHz: 0.5,
    turbulence: 0.16,
    scale: 1.12,
    label: "Listening",
  },
  thinking: {
    core: AUBERGINE,
    rim: SILVER,
    energy: 0.6,
    pulseHz: 1.1,
    turbulence: 0.42,
    scale: 0.97,
    label: "Thinking",
  },
  speaking: {
    core: SILVER,
    rim: GOLD,
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
    core: CRIMSON,
    rim: GOLD,
    energy: 0.9,
    pulseHz: 2.1,
    turbulence: 0.55,
    scale: 0.92,
    label: "Working on your computer",
  },
  approval: {
    /*
     * Gold through and through, and slow. A question does not need urgency; it
     * needs to be impossible to miss and comfortable to sit with while the
     * person reads what they are agreeing to.
     */
    core: GOLD,
    rim: GOLD,
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
     * has the controls; OCADE is present and not acting. Silver rim rather
     * than ash says "still here" without saying "about to move".
     */
    core: ASH,
    rim: AUBERGINE,
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
    core: CRIMSON,
    rim: CRIMSON,
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
 * than `acting` on purpose: reading the screen changes nothing, and colouring
 * it crimson would spend the alarm on the safe half of the loop.
 */
export function orbStateFor(input: {
  phase?: string | null;
  awaitingApproval?: boolean;
  userHasControl?: boolean;
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
      return "acting";
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
