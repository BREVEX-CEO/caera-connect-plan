/**
 * The Control + Work system: the same eight planets, seen from above, reporting
 * what OCADE is actually doing to this computer.
 *
 * WHY THIS IS A SECOND SCENE RATHER THAN THE LANDING ONE WITH A PROP
 * -------------------------------------------------------------------
 * The landing scene is an approved piece of identity. It has a camera you can
 * drag, a full WebGL pipeline, custom shaders and a 600 KiB engine behind it,
 * and it exists to be looked at. This one has a job: to say, without words and
 * without a dashboard, whether OCADE is idle, listening, thinking, watching the
 * screen, acting on it, speaking, paused or stopped.
 *
 * Bolting eight operational states onto the landing scene would have made the
 * approved animation conditional on runtime state, which is how an approved
 * thing stops being the thing that was approved. So the BODIES are shared —
 * `solar-data` is imported, the same eight planets in the same order, Uranus
 * with the same twenty-eight moons — and the rendering is its own.
 *
 * AND WHY IT IS 2D CANVAS RATHER THAN A SECOND WebGL CONTEXT
 * -----------------------------------------------------------
 * A browser keeps a small number of WebGL contexts alive and silently kills the
 * oldest. A user who opens the landing page, goes to Control + Work and comes
 * back would be the one who finds out. A top view also has no perspective to
 * render: every orbit is a circle and every body is a disc, which canvas draws
 * at 60fps on integrated graphics for a fraction of the cost.
 *
 * PURE, SO THE MOTION CAN BE ARGUED WITH
 * ---------------------------------------
 * `bodiesAt` and `motionFor` are functions of time and state. Whether "paused"
 * is genuinely slower than "idle", and whether "stopped" genuinely freezes,
 * are assertions a test makes rather than claims a comment makes.
 */

import { PLANETS, SUN_RADIUS, URANUS_MOONS, radiusFor } from "@/lib/landing/solar-data";

/**
 * What OCADE is doing, as the scene understands it.
 *
 * Deliberately the states a PERSON can distinguish while watching, not the
 * states the agent loop has internally. "Classifying the request" and "loading
 * tool schemas" are both `thinking` here, because to someone watching they are
 * the same thing: OCADE has their instruction and has not touched anything yet.
 */
export type ControlState =
  /** Nothing asked. The system turns quietly. */
  | "idle"
  /** The microphone is open. */
  | "listening"
  /** The instruction has landed; OCADE is deciding. */
  | "thinking"
  /** Reading the screen, the windows, the machine. Nothing is being changed. */
  | "observing"
  /** Acting on this computer right now. */
  | "controlling"
  /** Speaking a reply aloud. */
  | "speaking"
  /** Held by the user. Everything keeps its place; it just slows. */
  | "paused"
  /** Stopped by the user. Execution state freezes exactly where it was. */
  | "stopped"
  /** Something failed and OCADE has not hidden it. */
  | "error";

export interface Motion {
  /** Multiplier on every orbit. `0` is a freeze, not a slow drift. */
  orbitRate: number;
  /** Sun radius modulation, 0–1. Drives the pulse and the TTS reaction. */
  sunPulse: number;
  /** Opacity of the planet-to-planet connections, 0–1. Always subtle. */
  connectionOpacity: number;
  /** 0–1 sweep position when OCADE is reading the screen; null otherwise. */
  scan: number | null;
  /** True when the scene is showing a held state rather than a live one. */
  frozen: boolean;
  /** One short line, for the label under the scene and for screen readers. */
  caption: string;
}

/** How loud the reply is, right now. Only `speaking` uses it. */
export interface MotionInput {
  state: ControlState;
  /** Seconds since the scene started. */
  time: number;
  /** 0–1 speech amplitude, from the voice layer. Optional. */
  amplitude?: number;
}

const BASE_CONNECTION_OPACITY = 0.06;

/**
 * The motion for one state at one moment.
 *
 * The numbers are the design: nothing here exceeds a 1.6x orbit rate or a 0.22
 * connection opacity, because a scene that shouts during execution is a scene
 * the user turns off, and then it reports nothing at all.
 */
export function motionFor({ state, time, amplitude = 0 }: MotionInput): Motion {
  const wave = (period: number) => (Math.sin((time * Math.PI * 2) / period) + 1) / 2;

  switch (state) {
    case "listening":
      // A slow breath. Present enough to answer "is it hearing me?", quiet
      // enough not to compete with the person speaking.
      return {
        orbitRate: 1,
        sunPulse: 0.25 + wave(2.4) * 0.35,
        connectionOpacity: BASE_CONNECTION_OPACITY * 1.4,
        scan: null,
        frozen: false,
        caption: "Listening",
      };
    case "thinking":
      return {
        orbitRate: 1.45,
        sunPulse: 0.2 + wave(1.1) * 0.2,
        connectionOpacity: 0.16 + wave(1.7) * 0.06,
        scan: null,
        frozen: false,
        caption: "Thinking",
      };
    case "observing":
      // Restrained: the system barely moves and a single sweep passes over it.
      // Watching should not look like working.
      return {
        orbitRate: 0.65,
        sunPulse: 0.12,
        connectionOpacity: 0.1,
        scan: (time * 0.22) % 1,
        frozen: false,
        caption: "Looking at this computer",
      };
    case "controlling":
      return {
        orbitRate: 1.6,
        sunPulse: 0.3 + wave(0.7) * 0.3,
        connectionOpacity: 0.22,
        scan: null,
        frozen: false,
        caption: "Working on this computer",
      };
    case "speaking":
      // The Sun answers the voice. Clamped, so a loud syllable cannot make the
      // centre of the scene flare across the panel.
      return {
        orbitRate: 1,
        sunPulse: 0.2 + Math.min(1, Math.max(0, amplitude)) * 0.65,
        connectionOpacity: BASE_CONNECTION_OPACITY * 1.6,
        scan: null,
        frozen: false,
        caption: "Speaking",
      };
    case "paused":
      return {
        orbitRate: 0.22,
        sunPulse: 0.08,
        connectionOpacity: BASE_CONNECTION_OPACITY,
        scan: null,
        frozen: false,
        caption: "Paused",
      };
    case "stopped":
      /*
       * Zero, not "very slow". A stop the user pressed has to be visibly a stop
       * — if the system keeps drifting, the honest question "did it actually
       * stop?" has no answer on screen, and that is the one moment where the
       * interface must not be ambiguous.
       */
      return {
        orbitRate: 0,
        sunPulse: 0,
        connectionOpacity: BASE_CONNECTION_OPACITY * 0.6,
        scan: null,
        frozen: true,
        caption: "Stopped",
      };
    case "error":
      /*
       * Held, like `stopped`, and for the same reason: something went wrong and
       * a system that carries on turning underneath the message reads as though
       * the message were cosmetic. The difference from `stopped` is the Sun,
       * which keeps a low ember rather than going dark — OCADE is still here,
       * it just could not do that.
       */
      return {
        orbitRate: 0,
        sunPulse: 0.14,
        connectionOpacity: BASE_CONNECTION_OPACITY * 0.6,
        scan: null,
        frozen: true,
        caption: "Could not finish",
      };
    case "idle":
    default:
      return {
        orbitRate: 1,
        sunPulse: 0.1 + wave(6) * 0.06,
        connectionOpacity: BASE_CONNECTION_OPACITY,
        scan: null,
        frozen: false,
        caption: "Ready",
      };
  }
}

export interface Body {
  id: string;
  name: string;
  /** Scene-unit position. The Sun is at the origin. */
  x: number;
  y: number;
  /** Scene-unit radius. */
  r: number;
  /** `#rrggbb`. */
  colour: string;
  orbit: number;
}

export interface SystemAt {
  planets: Body[];
  /** Uranus's twenty-eight, positioned relative to the scene origin. */
  moons: Body[];
  /** Where Uranus is, so the moon field can be framed. */
  uranus: Body;
}

function hex(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

/**
 * Every body's position at a moment.
 *
 * `phase` is the accumulated orbital angle rather than raw elapsed time, so the
 * caller integrates rate over time and a change of state — speeding up, slowing
 * to a pause, freezing — never teleports a planet. Passing `time * rate` here
 * instead would jump every planet the instant the rate changed.
 */
export function bodiesAt(phase: number): SystemAt {
  const planets: Body[] = PLANETS.map((planet) => {
    const angle = planet.phase + phase * planet.speed;
    return {
      id: planet.id,
      name: planet.name,
      x: Math.cos(angle) * planet.orbit,
      y: Math.sin(angle) * planet.orbit,
      r: planet.radius,
      colour: hex(planet.color),
      orbit: planet.orbit,
    };
  });

  const uranus = planets.find((p) => p.id === "uranus");
  if (!uranus) throw new Error("The Control + Work system requires Uranus.");

  const moons: Body[] = URANUS_MOONS.map((moon, index) => {
    const angle = moon.phase + phase * moon.speed;
    return {
      id: `moon-${index}`,
      name: moon.name,
      x: uranus.x + Math.cos(angle) * moon.orbit,
      y: uranus.y + Math.sin(angle) * moon.orbit,
      r: radiusFor(moon.km),
      colour: "#a9f0f4",
      orbit: moon.orbit,
    };
  });

  return { planets, moons, uranus };
}

/** The scene's own extent in scene units, so a caller can fit it to a box. */
export const SYSTEM_EXTENT = Math.max(...PLANETS.map((p) => p.orbit)) + 3;

export { SUN_RADIUS };

/**
 * The eight connections drawn between planets, as index pairs.
 *
 * A RING, NOT A MESH. Every pair is twenty-eight lines, and at any moment
 * several of them pass through the Sun — which reads as a rendering fault
 * rather than as a relationship. Consecutive pairs say "these are connected"
 * with eight strokes, follow the orbital order the eye already has, and never
 * cross the centre.
 */
export const CONNECTIONS: [number, number][] = PLANETS.map(
  (_planet, index) => [index, (index + 1) % PLANETS.length] as [number, number],
);

/**
 * How much of the scene to draw.
 *
 * NOT A USER SETTING, AND NOT GUESSED FROM THE HARDWARE. The renderer measures
 * how long its own frames take and steps down when it cannot hold the budget.
 * A device-memory heuristic decides once, at load, on a number the browser
 * rounds to a power of two — and is wrong about the machine that is fast but
 * currently busy, which is exactly the machine Control + Work runs on while
 * OCADE is driving three applications.
 *
 *   full     — everything below.
 *   reduced  — no data ticks on the orbit rings, no planet aura.
 *   minimal  — rings, discs, moons. Still the whole system, still truthful.
 */
export type SceneQuality = "full" | "reduced" | "minimal";

export interface PaintOptions {
  /** CSS pixels. The caller owns the device-pixel-ratio transform. */
  width: number;
  height: number;
  motion: Motion;
  /** Accumulated orbital phase — see `bodiesAt`. */
  phase: number;
  quality?: SceneQuality;
  /** Planet names beside their discs. Off on small canvases. */
  labels?: boolean;
}

/**
 * One frame, as an ordinary function call.
 *
 * Extracted from the component for the same reason the landing painter was: a
 * draw loop inside a `useEffect` closure can only be reached through
 * `requestAnimationFrame`, which does not run in a test environment or a
 * background tab, so the drawing is the part that ends up with no coverage.
 */
export function paintControlSystem(
  context: CanvasRenderingContext2D,
  { width, height, motion, phase, quality = "full", labels = true }: PaintOptions,
): SystemAt {
  const { planets, moons, uranus } = bodiesAt(phase);

  context.clearRect(0, 0, width, height);

  const centreX = width / 2;
  const centreY = height / 2;
  // Fit the whole system to the shorter axis, with room for the outermost
  // orbit ring and Uranus's moon field when it swings wide.
  const scale = Math.min(width, height) / (SYSTEM_EXTENT * 2.1);
  const px = (value: number) => value * scale;
  const toX = (value: number) => centreX + px(value);
  const toY = (value: number) => centreY + px(value);
  const rich = quality === "full";
  const dim = motion.frozen ? 0.55 : 1;

  /* --------------------------------------------------------- orbit rings --
   * Gold rather than grey, and two passes: a continuous hairline, then short
   * ticks along it at `full` quality. The ticks are what make the rings read as
   * instrumentation rather than as decoration — they are the "data lines" — and
   * they are the first thing dropped when the frame budget is tight, because
   * they are also the most expensive thing here.
   */
  context.lineWidth = 1;
  for (const planet of PLANETS) {
    const radius = px(planet.orbit);
    context.beginPath();
    context.strokeStyle = `rgba(214, 168, 88, ${0.16 * dim})`;
    context.arc(centreX, centreY, radius, 0, Math.PI * 2);
    context.stroke();

    if (rich && radius > 40) {
      // Tick density falls with radius so the inner rings are not solid.
      const ticks = Math.min(90, Math.max(24, Math.round(radius / 7)));
      const drift = phase * planet.speed * 0.5;
      context.beginPath();
      context.strokeStyle = `rgba(232, 190, 120, ${0.2 * dim})`;
      for (let index = 0; index < ticks; index += 1) {
        const angle = drift + (index / ticks) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        context.moveTo(centreX + cos * (radius - 1.4), centreY + sin * (radius - 1.4));
        context.lineTo(centreX + cos * (radius + 1.4), centreY + sin * (radius + 1.4));
      }
      context.stroke();
    }
  }

  /* --------------------------------------------------------- connections -- */
  context.lineWidth = 1;
  for (const [from, to] of CONNECTIONS) {
    const a = planets[from];
    const b = planets[to];
    if (!a || !b) continue;
    context.beginPath();
    context.strokeStyle = `rgba(226, 190, 120, ${motion.connectionOpacity})`;
    context.moveTo(toX(a.x), toY(a.y));
    context.lineTo(toX(b.x), toY(b.y));
    context.stroke();
  }

  /* ----------------------------------------------------------------- sun -- */
  const sunRadius = px(SUN_RADIUS) * (1 + motion.sunPulse * 0.3);
  const corona = context.createRadialGradient(
    centreX,
    centreY,
    sunRadius * 0.1,
    centreX,
    centreY,
    sunRadius * 3.1,
  );
  corona.addColorStop(0, `rgba(255, 236, 178, ${(0.62 + motion.sunPulse * 0.3) * dim})`);
  corona.addColorStop(0.28, `rgba(255, 186, 74, ${(0.34 + motion.sunPulse * 0.2) * dim})`);
  corona.addColorStop(0.62, `rgba(214, 128, 34, ${0.12 * dim})`);
  corona.addColorStop(1, "rgba(214, 128, 34, 0)");
  context.beginPath();
  context.fillStyle = corona;
  context.arc(centreX, centreY, sunRadius * 3.1, 0, Math.PI * 2);
  context.fill();

  const body = context.createRadialGradient(
    centreX - sunRadius * 0.2,
    centreY - sunRadius * 0.2,
    sunRadius * 0.1,
    centreX,
    centreY,
    sunRadius,
  );
  body.addColorStop(0, "#fff6d8");
  body.addColorStop(0.5, "#ffca5e");
  body.addColorStop(1, "#f08a1c");
  context.beginPath();
  context.fillStyle = body;
  context.arc(centreX, centreY, sunRadius, 0, Math.PI * 2);
  context.fill();

  /* ------------------------------------------------------------- planets -- */
  for (const planet of planets) {
    const x = toX(planet.x);
    const y = toY(planet.y);
    const radius = Math.max(2, px(planet.r) * 1.35);

    if (rich) {
      // A soft aura in the planet's own colour, so eight discs on a black field
      // read as bodies with atmosphere rather than as dots.
      const aura = context.createRadialGradient(x, y, radius * 0.7, x, y, radius * 2.4);
      aura.addColorStop(0, `${planet.colour}55`);
      aura.addColorStop(1, `${planet.colour}00`);
      context.beginPath();
      context.fillStyle = aura;
      context.arc(x, y, radius * 2.4, 0, Math.PI * 2);
      context.fill();
    }

    // Lit from the Sun: the highlight sits on the side facing the centre, which
    // is the one cue that makes a flat disc look spherical.
    const towards = Math.atan2(centreY - y, centreX - x);
    const sphere = context.createRadialGradient(
      x + Math.cos(towards) * radius * 0.38,
      y + Math.sin(towards) * radius * 0.38,
      radius * 0.12,
      x,
      y,
      radius,
    );
    sphere.addColorStop(0, planet.colour);
    sphere.addColorStop(0.62, planet.colour);
    sphere.addColorStop(1, "rgba(0, 0, 0, 0.72)");
    context.beginPath();
    context.fillStyle = sphere;
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();

    // Saturn without its ring is not Saturn.
    if (planet.id === "saturn") {
      context.save();
      context.translate(x, y);
      context.scale(1, 0.32);
      context.beginPath();
      context.strokeStyle = `rgba(226, 202, 148, ${0.5 * dim})`;
      context.lineWidth = Math.max(1, radius * 0.32);
      context.arc(0, 0, radius * 1.85, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      context.lineWidth = 1;
    }

    if (labels) {
      context.font = "600 10px ui-sans-serif, system-ui, sans-serif";
      context.textAlign = "center";
      context.fillStyle = `rgba(240, 228, 200, ${0.62 * dim})`;
      context.fillText(planet.name.toUpperCase(), x, y - radius - 8);
    }
  }

  /* ------------------------------------------------ Uranus's twenty-eight --
   * Drawn last and small. They are the detail that rewards a second look, not
   * a feature competing with the eight — and the count is stated on the canvas
   * because twenty-eight specks is a thing nobody will ever count by eye.
   */
  const moonField = px(13.2);
  context.beginPath();
  context.strokeStyle = `rgba(169, 240, 244, ${0.13 * dim})`;
  context.arc(toX(uranus.x), toY(uranus.y), moonField, 0, Math.PI * 2);
  context.stroke();

  for (const moon of moons) {
    const radius = Math.max(0.7, px(moon.r) * 2.6);
    context.beginPath();
    context.fillStyle = `rgba(198, 244, 247, ${(motion.frozen ? 0.4 : 0.72) * 1})`;
    context.arc(toX(moon.x), toY(moon.y), radius, 0, Math.PI * 2);
    context.fill();
  }

  if (labels) {
    context.font = "600 9px ui-sans-serif, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillStyle = `rgba(226, 232, 240, ${0.45 * dim})`;
    context.fillText("28 MOONS", toX(uranus.x), toY(uranus.y) + moonField + 14);
  }

  /* ---------------------------------------------------------- scan sweep -- */
  if (motion.scan !== null) {
    const angle = motion.scan * Math.PI * 2;
    const reach = px(SYSTEM_EXTENT);
    const sweep = context.createLinearGradient(
      centreX,
      centreY,
      centreX + Math.cos(angle) * reach,
      centreY + Math.sin(angle) * reach,
    );
    sweep.addColorStop(0, "rgba(240, 220, 170, 0.22)");
    sweep.addColorStop(1, "rgba(240, 220, 170, 0)");
    context.beginPath();
    context.strokeStyle = sweep;
    context.lineWidth = 1.5;
    context.moveTo(centreX, centreY);
    context.lineTo(centreX + Math.cos(angle) * reach, centreY + Math.sin(angle) * reach);
    context.stroke();
    context.lineWidth = 1;
  }

  return { planets, moons, uranus };
}
