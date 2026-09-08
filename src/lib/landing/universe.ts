/**
 * The OCADE universe: eight capabilities in orbit around one core.
 *
 * THE DATA IS SEPARATE FROM THE RENDERER on purpose. Orbit geometry, hit
 * testing and the copy on each planet are pure functions of time and pointer
 * position, so the whole thing can be reasoned about — and tested — without a
 * canvas, a GPU, or a browser. The renderer draws what this computes.
 *
 * EVERY PLANET IS A REAL CAPABILITY WITH A REAL BENEFIT. A decorative sphere
 * labelled "Innovation" is the thing this file exists to avoid: each entry
 * names something OCADE does and what it saves the person doing it, and the
 * benefit lines are the ones the product can actually keep.
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

export interface PlanetPosition {
  planet: Planet;
  /** Scene-space coordinates. */
  x: number;
  y: number;
  z: number;
  /** Projected screen position, 0–1 of the viewport. */
  sx: number;
  sy: number;
  /** Apparent radius after projection, in the same 0–1 space. */
  sr: number;
  /** 1 nearest the camera, 0 furthest. Drives depth-of-field and draw order. */
  depth: number;
  /** How far the body has turned on its own axis, radians. */
  spinAngle: number;
}

export interface CameraState {
  /** Horizontal rotation, radians. */
  yaw: number;
  /** Vertical tilt, radians. Clamped so the system never flips. */
  pitch: number;
  /** Distance from the core. */
  distance: number;
  /**
   * Look-at offset in ROTATED scene units, applied after the yaw/pitch rotation
   * and before the perspective divide. Moves what the camera is pointed at away
   * from the core, which is what lets the view settle on one planet.
   *
   * OPTIONAL, AND THAT IS DELIBERATE. Absent means zero, so every camera
   * written before this existed — including `DEFAULT_CAMERA` and every camera
   * in the fit-everything invariant tests — projects to exactly the same pixels
   * it did before. The free-orbit camera is unchanged; only a deliberate focus
   * moves the target off the core.
   */
  panX?: number;
  panY?: number;
  /**
   * Multiplier on the fitted focal length. 1 (or absent) is the framing that
   * fits all eight orbits.
   *
   * Zooming in is expressed here rather than by shortening `distance`, because
   * distance also changes the parallax and the apparent orbit spacing — pulling
   * the camera in far enough to fill the frame with one planet turns the system
   * inside out on the way. A focal multiplier is a lens change: it magnifies
   * what is already there without moving the observer through the system.
   */
  zoom?: number;
}

export const DEFAULT_CAMERA: CameraState = { yaw: 0.4, pitch: 0.32, distance: 13 };

/** Vertical tilt is clamped: past this the orbits collapse into a line. */
export const MAX_PITCH = 1.05;
export const MIN_PITCH = -0.35;
export const MIN_DISTANCE = 8;
export const MAX_DISTANCE = 22;

/**
 * How far the lens may be pushed when the view settles on one planet.
 *
 * 4.2 fills roughly a third of the frame with the largest body — close enough
 * to read as "this one", far enough that its neighbours are still visible at
 * the edges, which is what keeps it feeling like a system rather than a
 * slideshow.
 */
export const MAX_ZOOM = 4.2;
export const MIN_ZOOM = 1;

export function clampCamera(camera: CameraState): CameraState {
  const clamped: CameraState = {
    yaw: camera.yaw,
    pitch: Math.min(MAX_PITCH, Math.max(MIN_PITCH, camera.pitch)),
    distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, camera.distance)),
  };
  /*
   * Carried through only when set. Writing `panX: 0` unconditionally would
   * change the `framingFor` cache key for every existing caller and, worse,
   * make a camera that has never been focused indistinguishable from one that
   * has been focused back to centre — which is the state the idle return has to
   * be able to detect.
   */
  if (camera.panX !== undefined || camera.panY !== undefined) {
    clamped.panX = camera.panX ?? 0;
    clamped.panY = camera.panY ?? 0;
  }
  if (camera.zoom !== undefined) {
    clamped.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom));
  }
  return clamped;
}

/**
 * How much of the viewport the outermost orbit is allowed to fill.
 *
 * Below 1 so the widest orbit clears the edge instead of being cropped by it.
 */
export const FRAME_FILL = 0.88;

/**
 * Planet radii are exaggerated, on purpose.
 *
 * At the focal length that fits all eight orbits on screen, a physically
 * consistent sphere is about seven pixels across — technically correct and
 * useless, which is why every solar-system diagram ever drawn does the same
 * thing. POSITIONS stay exact; only the drawn radius is scaled, so hit testing
 * still matches what the eye sees.
 */
export const PLANET_SCALE = 2.2;

/** The framing the scene had before it was computed. Never zoom in past it. */
export const BASE_FOCAL = 8;

/**
 * The focal length below which the planets stop being legible.
 *
 * Fitting eight orbits into a 390px-wide phone screen purely by pulling the
 * camera back produces three-pixel spheres — every planet technically on
 * screen and not one of them visible or tappable. Measured, not guessed: at
 * focal 0.84 the smallest planet came out 3.3px across on a 390×844 viewport.
 */
export const MIN_FOCAL = 2.2;

/**
 * The focal length that fits the whole system in the viewport.
 *
 * THE DEFECT THIS FIXES. The focal length used to be the constant 8, which
 * framed the scene correctly for exactly one aspect ratio and one camera
 * distance. At the default camera on an ordinary 16:9 window, FOUR OF THE EIGHT
 * planets projected outside the viewport — `automations` landed at sx 1.71,
 * `links` and `voice` off the left edge, `projects` above the top. Half the
 * capabilities the landing page exists to advertise were never drawn.
 *
 * It survived a thorough geometry test suite because every one of those tests
 * asserted a property of the projection — finite, ordered, hit-testable — and
 * none asserted the thing that actually mattered: that the result lands ON
 * SCREEN. It was caught by reading pixels back off a real canvas.
 *
 * Derived from the live camera and aspect ratio, so it also fixes the case
 * nobody had looked at at all: a portrait phone, where aspect < 1 and the
 * overflow is far worse.
 *
 * SOLVED EXACTLY, NOT ESTIMATED. The first attempt bounded the extent
 * analytically from the outermost orbit and the pitch, and it was WRONG — it
 * used the camera distance as the depth, but `safeZ` is `distance - z`, so a
 * planet swinging towards the viewer is magnified by up to 2x. Wide screens
 * still dropped planets off the bottom edge (sy reached 1.43 on ultrawide).
 *
 * The exact solution is available and no harder: both screen offsets are
 * LINEAR in the focal length, because focal appears only in `scale = focal /
 * safeZ` and `safeZ` does not depend on it. So project every orbit at focal 1,
 * take the largest offset actually produced, and divide. Sampling the whole
 * orbit rather than one instant is what makes it hold as the planets move.
 */
export function focalFor(camera: CameraState, aspect: number, planets: Planet[] = PLANETS): number {
  const half = FRAME_FILL * 0.5;
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);

  let worstX = 0;
  let worstY = 0;

  for (const planet of planets) {
    // The extreme is always on the orbit, so the whole circle is sampled
    // rather than the planet's position at one moment. 32 steps puts the
    // sampling error well inside the margin `FRAME_FILL` already leaves.
    for (let i = 0; i < 32; i += 1) {
      const angle = (i / 32) * Math.PI * 2;
      const ox = Math.cos(angle) * planet.orbit;
      const oz = Math.sin(angle) * planet.orbit;
      const oy = Math.sin(angle) * planet.orbit * Math.sin(planet.tilt);

      const rx = ox * cosYaw - oz * sinYaw;
      const rz = ox * sinYaw + oz * cosYaw;
      const ry = oy * cosPitch - rz * sinPitch;
      const rzz = oy * sinPitch + rz * cosPitch;

      // The same near-plane guard the projection uses, so the bound is
      // computed against the geometry that will actually be drawn.
      const safeZ = Math.max(0.35, camera.distance - rzz);
      // Offsets from centre at focal = 1. Both are linear in focal.
      worstX = Math.max(worstX, Math.abs(rx / safeZ / (2 * aspect)));
      worstY = Math.max(worstY, Math.abs(ry / safeZ / 2));
    }
  }

  const worst = Math.max(worstX, worstY);
  if (!Number.isFinite(worst) || worst <= 0) return BASE_FOCAL;
  return Math.min(half / worst, BASE_FOCAL);
}

/**
 * How to frame the system: focal length, plus how far to pull the orbits in.
 *
 * THE TENSION THIS RESOLVES. On a narrow screen the two goals fight. Fitting
 * all eight orbits demands a short focal length, and a short focal length makes
 * every planet too small to see or tap — on a 390px phone the fit-everything
 * focal produced 3px spheres. Choosing either goal alone gives a broken page:
 * clipped capabilities, or invisible ones.
 *
 * So the focal length is floored at legibility, and when that floor bites, the
 * ORBITS are compressed by exactly the ratio the focal was raised by. The
 * system draws tighter around the core on a phone and stays fully visible with
 * readable planets. It reads as a deliberately compact layout, which is what a
 * responsive design is.
 */
export interface Framing {
  focal: number;
  orbitScale: number;
}

/**
 * One-entry memo.
 *
 * `focalFor` samples 32 points on each of 8 orbits, and the orbit-ring pass
 * asks for the framing at all 73 points of all 8 rings — nearly 150,000
 * iterations per frame if it were recomputed each time. The framing depends
 * only on the camera and the aspect ratio, both of which are constant within a
 * frame and change only when the user drags or the window resizes, so a single
 * remembered result collapses that back to one computation per camera change.
 */
let cachedKey = "";
let cachedFraming: Framing = { focal: BASE_FOCAL, orbitScale: 1 };

export function framingFor(
  camera: CameraState,
  aspect: number,
  planets: Planet[] = PLANETS,
): Framing {
  const key =
    planets === PLANETS
      ? // The zoom belongs in the key: it multiplies the focal, so a cache that
        // ignored it would hand a zoomed frame the unzoomed lens and the view
        // would refuse to magnify. Pan does not — it moves the look-at point
        // after the fit is computed, and the fit is what is memoised.
        `${camera.yaw}|${camera.pitch}|${camera.distance}|${aspect}|${camera.zoom ?? 1}`
      : // A custom planet set (tests) is never cached: the key cannot describe
        // it, and a stale hit would silently answer for the wrong system.
        "";
  if (key && key === cachedKey) return cachedFraming;

  const fit = focalFor(camera, aspect, planets);
  // The lens multiplier is applied AFTER the fit, never inside it. `focalFor`
  // answers "what frames all eight orbits"; zoom is the deliberate decision to
  // stop framing all eight and look at one. Folding zoom into the fit would
  // make the fit fight the zoom and settle back to showing everything.
  const focal = Math.max(fit, MIN_FOCAL) * (camera.zoom ?? 1);
  // Only compresses when legibility forced the focal up; 1 on any normal
  // desktop or laptop window, where `fit` already clears the floor.
  const orbitScale = fit < MIN_FOCAL ? fit / MIN_FOCAL : 1;
  const framing: Framing = { focal, orbitScale };

  if (key) {
    cachedKey = key;
    cachedFraming = framing;
  }
  return framing;
}

/**
 * Where every planet is at time `t`, projected for the given camera.
 *
 * Deliberately a plain perspective divide rather than a matrix library: the
 * scene is eight points on tilted circles, and pulling in a 3D engine to place
 * them would be several hundred kilobytes to compute what fits in ten lines.
 */
export function positionsAt(
  t: number,
  camera: CameraState,
  aspect: number,
  planets: Planet[] = PLANETS,
): PlanetPosition[] {
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);
  // Computed once per frame, not per planet: it depends only on the camera and
  // the viewport, and it must be identical for every body or the system would
  // not hold together.
  const { focal, orbitScale } = framingFor(camera, aspect, planets);
  // Absent means centred on the core, which is what every camera written
  // before focusing existed means.
  const panX = camera.panX ?? 0;
  const panY = camera.panY ?? 0;

  const positions = planets.map((planet) => {
    const angle = planet.phase + t * planet.speed;
    const orbit = planet.orbit * orbitScale;
    // Orbit in its own plane, then tip that plane by the inclination.
    const ox = Math.cos(angle) * orbit;
    const oz = Math.sin(angle) * orbit;
    const oy = Math.sin(angle) * orbit * Math.sin(planet.tilt);

    // Yaw about the vertical axis, then pitch the whole system towards us.
    const rx = ox * cosYaw - oz * sinYaw;
    const rz = ox * sinYaw + oz * cosYaw;
    const ry = oy * cosPitch - rz * sinPitch;
    const rzz = oy * sinPitch + rz * cosPitch;

    // Perspective divide. The camera sits on +Z looking at the origin.
    const viewZ = camera.distance - rzz;
    // Guard the divide: a planet passing through the camera plane would
    // otherwise produce an infinity and take the whole frame with it.
    const safeZ = Math.max(0.35, viewZ);
    const scale = focal / safeZ;

    return {
      planet,
      x: rx,
      y: ry,
      z: rzz,
      /*
       * The pan is subtracted in ROTATED space, before the divide, so the
       * look-at point tracks a body through the perspective rather than
       * sliding the finished image. Panning the projected result instead
       * would drag the whole frame including the parallax, and a planet the
       * camera was following would drift off its own centre as it moved
       * towards or away from the viewer.
       */
      sx: 0.5 + ((rx - panX) * scale) / (2 * aspect),
      sy: 0.5 - ((ry - panY) * scale) / 2,
      sr: (planet.size * scale * PLANET_SCALE) / 2,
      depth: 1 - (safeZ - (camera.distance - MAX_DISTANCE)) / (2 * MAX_DISTANCE),
      /*
       * How far this body has turned on its own axis, radians.
       *
       * Carried on the position rather than recomputed by the renderer so the
       * surface and the sphere can never disagree about which way round the
       * planet is — two copies of `t * spin` in different modules is the same
       * class of bug as the focal length that the orbit rings once duplicated.
       */
      spinAngle: planet.phase * 3.1 + t * planet.spin,
    };
  });

  // Painter's algorithm: furthest first, so nearer planets occlude.
  return positions.sort((a, b) => a.z - b.z);
}

/**
 * Which planet is under the pointer, if any.
 *
 * Nearest-to-camera wins where two overlap, which is what the eye expects.
 * The hit radius is padded because a 14px sphere is a cruel target on a
 * trackpad, and the padding is generous enough to matter on touch.
 */
export function planetAtPointer(
  positions: PlanetPosition[],
  px: number,
  py: number,
  aspect: number,
  padding = 1.9,
): PlanetPosition | null {
  let best: PlanetPosition | null = null;
  for (const position of positions) {
    // Compare in square space, or the hit area is an ellipse on a wide screen.
    const dx = (position.sx - px) * aspect;
    const dy = position.sy - py;
    const distance = Math.hypot(dx, dy);
    if (distance <= position.sr * padding) {
      if (!best || position.z > best.z) best = position;
    }
  }
  return best;
}

/* --------------------------------------------------------- interconnection -- */

/**
 * Which planets are wired to which.
 *
 * A RING OF EIGHT, and the count is the point. Each body links to the next and
 * the eighth closes back to the first, so there are exactly as many connections
 * as there are planets — eight orbits, eight worlds, eight links — and the
 * number becomes a property of the picture rather than a caption under it.
 *
 * A FULL MESH WAS TRIED AND IS WRONG. Every pair is 28 lines; at any moment
 * roughly half of them cross the middle of the frame, and the result is a
 * cobweb over the core that obscures the thing the page is about. The ring
 * says "these are all connected" with eight strokes instead of twenty-eight.
 *
 * Pairs are indices into `PLANETS`, so a reordering of the array moves the
 * wires with it rather than silently connecting the wrong capabilities.
 */
export const CONNECTIONS: Array<[number, number]> = Array.from({ length: 8 }, (_, i) => [
  i,
  (i + 1) % 8,
]);

/* ------------------------------------------------------------ camera motion -- */

/**
 * How the camera actually moves.
 *
 * NOTHING IS EVER SET DIRECTLY. Drag, zoom, focus and the idle return all write
 * a TARGET, and the live camera is drawn towards it every frame. That single
 * rule is what makes the scene feel liquid instead of mechanical: there is no
 * code path anywhere that can teleport the view, so nothing can snap — not a
 * click, not the end of a drag, not the return to autonomous orbit.
 */
export interface CameraMotion {
  /** Where the camera is now. This is what gets drawn. */
  current: CameraState;
  /** Where it is heading. Written by every interaction. */
  target: CameraState;
  /** Radians per second of yaw carried out of a flick. */
  yawVelocity: number;
  /** Radians per second of pitch carried out of a flick. */
  pitchVelocity: number;
}

/**
 * The rate an exponential approach closes a gap, per second.
 *
 * 6.5 settles a drag in roughly 400ms — fast enough not to feel laggy under the
 * hand, slow enough that the tail of the movement is visible, which is the part
 * that reads as weight.
 */
export const CAMERA_STIFFNESS = 6.5;

/**
 * What is left of a flick's velocity after one second, as a fraction.
 *
 * 0.02 is a long, heavy glide: a hard flick coasts for about two seconds. The
 * system is meant to feel massive, and a spin that stops the instant the
 * pointer lifts feels like a scrollbar rather than like turning something.
 */
export const FLICK_DAMPING = 0.02;

/** Below this the glide is over; anything smaller is a shiver, not a spin. */
export const FLICK_EPSILON = 0.0006;

/**
 * How fast the system turns itself when nobody is touching it, radians/second.
 *
 * Slow on purpose. This is ambient presence, not a carousel: at 0.045 a full
 * revolution takes well over two minutes, so the scene is unmistakably alive
 * without ever pulling the eye off the text in front of it.
 */
export const AMBIENT_YAW_RATE = 0.045;

/**
 * How long after the last interaction the camera starts finding its way home.
 *
 * Long enough that a pause to read a benefit is not treated as abandonment,
 * short enough that a visitor who wandered off comes back to a composed frame.
 */
export const IDLE_RETURN_MS = 2600;

/**
 * Move a value a fraction of the way to its target, framerate-independently.
 *
 * `1 - e^(-k·dt)` rather than the usual `value += (target - value) * 0.1`. The
 * naive form is a different spring at every framerate — noticeably snappier at
 * 144Hz than at 60, and unusably slow on a machine dropping frames, which is
 * exactly the machine that can least afford a camera that lags behind the hand.
 */
export function approach(value: number, target: number, stiffness: number, dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return value;
  const factor = 1 - Math.exp(-stiffness * Math.max(0, dt));
  return value + (target - value) * factor;
}

/** The same, for an angle: takes the short way round rather than unwinding. */
export function approachAngle(
  value: number,
  target: number,
  stiffness: number,
  dt: number,
): number {
  /*
   * Without this, a camera at yaw 6.2 heading for 0.1 travels backwards through
   * the entire system to get there — six radians of unwanted spin, which is the
   * single most obvious way an eased camera betrays that it is eased.
   */
  const twoPi = Math.PI * 2;
  let delta = (target - value) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta < -Math.PI) delta += twoPi;
  return approach(value, value + delta, stiffness, dt);
}

/**
 * Advance the camera one frame.
 *
 * `idleMs` is how long since the user last did anything. Past `IDLE_RETURN_MS`
 * the target's yaw is advanced by the ambient rate, so the system resumes
 * turning on its own — and because that is written to the TARGET rather than to
 * the camera, the resumption is something the camera eases into from wherever
 * the user left it. There is no moment at which control changes hands.
 */
export function stepCamera(motion: CameraMotion, dt: number, idleMs: number): CameraMotion {
  const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.1) : 0;
  let { yawVelocity, pitchVelocity } = motion;
  const target = { ...motion.target };

  // A flick keeps turning the target after the pointer has gone.
  if (Math.abs(yawVelocity) > FLICK_EPSILON || Math.abs(pitchVelocity) > FLICK_EPSILON) {
    target.yaw += yawVelocity * step;
    target.pitch += pitchVelocity * step;
    const decay = Math.pow(FLICK_DAMPING, step);
    yawVelocity *= decay;
    pitchVelocity *= decay;
    if (Math.abs(yawVelocity) <= FLICK_EPSILON) yawVelocity = 0;
    if (Math.abs(pitchVelocity) <= FLICK_EPSILON) pitchVelocity = 0;
  } else {
    yawVelocity = 0;
    pitchVelocity = 0;
    // Autonomous orbit resumes only once the glide has fully died, so a flick
    // and the ambient drift never add up into a faster spin than either.
    if (idleMs >= IDLE_RETURN_MS) target.yaw += AMBIENT_YAW_RATE * step;
  }

  const clampedTarget = clampCamera(target);
  const current = clampCamera({
    yaw: approachAngle(motion.current.yaw, clampedTarget.yaw, CAMERA_STIFFNESS, step),
    pitch: approach(motion.current.pitch, clampedTarget.pitch, CAMERA_STIFFNESS, step),
    distance: approach(motion.current.distance, clampedTarget.distance, CAMERA_STIFFNESS, step),
    panX: approach(motion.current.panX ?? 0, clampedTarget.panX ?? 0, CAMERA_STIFFNESS, step),
    panY: approach(motion.current.panY ?? 0, clampedTarget.panY ?? 0, CAMERA_STIFFNESS, step),
    zoom: approach(motion.current.zoom ?? 1, clampedTarget.zoom ?? 1, CAMERA_STIFFNESS, step),
  });

  return { current, target: clampedTarget, yawVelocity, pitchVelocity };
}

/**
 * Where the camera should look to settle on one planet.
 *
 * Returns the pan that puts that body in the middle of the frame. Recomputed
 * every frame from the planet's CURRENT position, so the camera follows it
 * along its orbit rather than framing the spot where it used to be — the scene
 * stays alive while focused, which is the whole point of focusing on a moving
 * object.
 *
 * `null` for an unknown id rather than a zero pan: the caller needs to be able
 * to tell "no such planet" from "centred on the core", and silently returning
 * the core would make a typo look like a working un-focus.
 */
export function focusPanFor(
  positions: readonly PlanetPosition[],
  planetId: string,
): { panX: number; panY: number } | null {
  const found = positions.find((p) => p.planet.id === planetId);
  if (!found) return null;
  return { panX: found.x, panY: found.y };
}

/** A camera with nothing focused: centred on the core at the fitted framing. */
export function unfocusedTarget(camera: CameraState): CameraState {
  return { ...camera, panX: 0, panY: 0, zoom: 1 };
}

/* ------------------------------------------------------ intro sequencing -- */

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
