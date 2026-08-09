/**
 * One frame of the OCADE universe, as a pure function.
 *
 * WHY THIS IS NOT INSIDE THE COMPONENT. It was, and that made it unverifiable.
 * The draw loop lived in a closure inside a `useEffect`, reachable only through
 * `requestAnimationFrame`, which does not fire when a tab is not being
 * displayed. So the geometry had thorough tests — projection, hit testing,
 * camera clamping — while the DRAWING had none, and "the scene renders" rested
 * on somebody having looked at it once.
 *
 * Pulled out here, painting a frame is an ordinary function call against a 2D
 * context. It can be asserted against a recording context in a unit test, and
 * called directly on a real canvas in a browser to count the pixels it
 * produced. Neither needs an animation frame, a visible tab or a GPU.
 *
 * NO IMAGES, NO VIDEO, NO 3D LIBRARY. Every pixel is a gradient, an arc or a
 * dot. Canvas draws eight spheres, eight rings and a few hundred stars at 60fps
 * on the integrated graphics this product targets, while a WebGL context on the
 * same hardware costs more to create than this scene costs to draw.
 */

import {
  PLANETS,
  CONNECTIONS,
  positionsAt,
  framingFor,
  type CameraState,
  type Planet,
  type PlanetPosition,
  type RenderTier,
} from "./universe";

export interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
}

export interface PaintOptions {
  /** CSS pixels, not device pixels — the caller sets the DPR transform. */
  width: number;
  height: number;
  /** Seconds since the scene started. Drives every animated value. */
  time: number;
  camera: CameraState;
  tier: RenderTier;
  stars: readonly Star[];
  activePlanetId?: string | null;
}

/**
 * Generate the star field once.
 *
 * Separated because regenerating stars per frame produces a twitching field
 * that reads as a rendering fault rather than a starscape — a bug this scene
 * had until the field was hoisted out of the loop.
 */
export function makeStars(count: number, random: () => number = Math.random): Star[] {
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    r: random() * 1.1 + 0.25,
    a: random() * 0.5 + 0.12,
  }));
}

/** One orbit point, projected. Shares the maths with `positionsAt`. */
export function projectOrbitPoint(
  planet: Planet,
  angle: number,
  camera: CameraState,
  aspect: number,
): [number, number] {
  // Same framing as the planets. A ring drawn at a different focal length or
  // orbit scale than the planet riding it is the kind of error that looks like
  // a physics bug and is really two copies of one constant.
  const { focal, orbitScale } = framingFor(camera, aspect);
  const orbit = planet.orbit * orbitScale;
  const ox = Math.cos(angle) * orbit;
  const oz = Math.sin(angle) * orbit;
  const oy = Math.sin(angle) * orbit * Math.sin(planet.tilt);

  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);

  const rx = ox * cosYaw - oz * sinYaw;
  const rz = ox * sinYaw + oz * cosYaw;
  const ry = oy * cosPitch - rz * sinPitch;
  const rzz = oy * sinPitch + rz * cosPitch;

  // The camera-plane guard: without it a planet crossing the eye plane divides
  // by ~0 and throws coordinates to Infinity, which silently kills the frame.
  const safeZ = Math.max(0.35, camera.distance - rzz);
  const scale = focal / safeZ;
  return [0.5 + (rx * scale) / (2 * aspect), 0.5 - (ry * scale) / 2];
}

/**
 * Paint one frame. Returns the projected planet positions so the caller can hit
 * test against exactly what was drawn rather than recomputing it.
 */
export function paintUniverse(
  context: CanvasRenderingContext2D,
  options: PaintOptions,
): PlanetPosition[] {
  const { width: w, height: h, time: t, camera, tier, stars, activePlanetId } = options;
  const aspect = w / Math.max(1, h);

  context.clearRect(0, 0, w, h);

  /* ------------------------------------------------------- background --- */
  const sky = context.createRadialGradient(
    w * 0.5,
    h * 0.5,
    0,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.75,
  );
  sky.addColorStop(0, "oklch(0.17 0.02 90 / 0.85)");
  sky.addColorStop(0.55, "oklch(0.11 0.015 90 / 0.55)");
  sky.addColorStop(1, "oklch(0.06 0.01 90 / 0)");
  context.fillStyle = sky;
  context.fillRect(0, 0, w, h);

  for (const star of stars) {
    // Slow, out-of-phase twinkle. Uniform pulsing looks like a flicker bug.
    const twinkle = 0.6 + 0.4 * Math.sin(t * 0.7 + star.x * 40 + star.y * 25);
    context.globalAlpha = star.a * twinkle;
    context.fillStyle = "oklch(0.95 0.02 90)";
    context.beginPath();
    context.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  const positions = positionsAt(t, camera, aspect);

  /* ------------------------------------------------------ orbit rings --- */
  if (tier !== "static") {
    for (const planet of PLANETS) {
      context.beginPath();
      for (let i = 0; i <= 72; i += 1) {
        const a = (i / 72) * Math.PI * 2;
        const [rx, ry] = projectOrbitPoint(planet, a, camera, aspect);
        const px = rx * w;
        const py = ry * h;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      const active = activePlanetId === planet.id;
      context.strokeStyle = active
        ? `oklch(0.85 0.12 ${planet.hue} / 0.4)`
        : "oklch(0.85 0.02 90 / 0.09)";
      context.lineWidth = active ? 1.4 : 0.8;
      context.stroke();
    }
  }

  /* ------------------------------------------------ interconnection --- */
  /*
   * Eight wires for eight worlds — see `CONNECTIONS`.
   *
   * DRAWN BEFORE THE PLANETS, so a body passing in front of a wire hides it.
   * That single ordering choice is what makes the lines read as being IN the
   * scene rather than painted on the glass over it; drawn afterwards they cross
   * over the spheres and the whole thing flattens.
   *
   * TWO PASSES PER WIRE. A single stroke at low opacity is a grey hairline —
   * technically a connection, visually nothing. A wide, very faint pass under a
   * narrow, brighter one gives the line a halo, which is what "glowing" means
   * on a canvas with no shader and no `shadowBlur` (which is dramatically
   * slower than simply stroking twice).
   *
   * The pulse travels along the ring rather than blinking in place: a phase
   * offset per link, so brightness moves from planet to planet. A synchronised
   * fade reads as a flicker; a travelling one reads as something flowing.
   */
  if (tier !== "static") {
    // Indexed by id so a wire always joins the two planets it names, whatever
    // order the painter's algorithm left `positions` in.
    const byId = new Map(positions.map((p) => [p.planet.id, p]));
    for (let i = 0; i < CONNECTIONS.length; i += 1) {
      const [a, b] = CONNECTIONS[i];
      const from = byId.get(PLANETS[a].id);
      const to = byId.get(PLANETS[b].id);
      if (!from || !to) continue;

      const x1 = from.sx * w;
      const y1 = from.sy * h;
      const x2 = to.sx * w;
      const y2 = to.sy * h;

      // Depth of the pair, so a wire running behind the core dims with the
      // planets it joins instead of staying uniformly bright across the frame.
      const depth = Math.max(0, Math.min(1, (from.depth + to.depth) / 2));
      const travel = 0.55 + 0.45 * Math.sin(t * 0.6 - i * 0.78);
      const hue = (PLANETS[a].hue + PLANETS[b].hue) / 2;

      // The halo. Very wide, very faint — it must never read as a second line.
      context.strokeStyle = `oklch(0.82 0.09 ${hue} / ${(0.05 + 0.045 * travel) * (0.35 + 0.65 * depth)})`;
      context.lineWidth = 2.6;
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();

      // The wire itself. Sub-pixel on purpose: a 1px line at this opacity is
      // already the heaviest the composition will take without the ring
      // starting to compete with the planets it connects.
      context.strokeStyle = `oklch(0.93 0.07 ${hue} / ${(0.1 + 0.1 * travel) * (0.4 + 0.6 * depth)})`;
      context.lineWidth = 0.6;
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();
    }
  }

  /* --------------------------------------------------------------- core --- */
  const coreX = w * 0.5;
  const coreY = h * 0.5;
  const pulse = 1 + Math.sin(t * 0.9) * 0.045;
  const coreR = Math.min(w, h) * 0.055 * pulse;

  const halo = context.createRadialGradient(coreX, coreY, coreR * 0.3, coreX, coreY, coreR * 5);
  halo.addColorStop(0, "oklch(0.86 0.13 88 / 0.5)");
  halo.addColorStop(0.35, "oklch(0.8 0.12 88 / 0.13)");
  halo.addColorStop(1, "oklch(0.8 0.1 88 / 0)");
  context.fillStyle = halo;
  context.beginPath();
  context.arc(coreX, coreY, coreR * 5, 0, Math.PI * 2);
  context.fill();

  const body = context.createRadialGradient(
    coreX - coreR * 0.35,
    coreY - coreR * 0.4,
    coreR * 0.1,
    coreX,
    coreY,
    coreR,
  );
  body.addColorStop(0, "oklch(0.97 0.05 92)");
  body.addColorStop(0.6, "oklch(0.84 0.13 88)");
  body.addColorStop(1, "oklch(0.6 0.11 80)");
  context.fillStyle = body;
  context.beginPath();
  context.arc(coreX, coreY, coreR, 0, Math.PI * 2);
  context.fill();

  /* ------------------------------------------------------------ planets --- */
  for (const position of positions) {
    const { planet } = position;
    const px = position.sx * w;
    const py = position.sy * h;
    const pr = Math.max(2, position.sr * Math.min(w, h));
    const active = activePlanetId === planet.id;
    // Further planets dim, which is what makes the field read as depth rather
    // than as a flat ring of dots.
    const dim = 0.45 + 0.55 * Math.max(0, Math.min(1, position.depth));

    if (active) {
      const glow = context.createRadialGradient(px, py, pr * 0.5, px, py, pr * 4);
      glow.addColorStop(0, `oklch(0.85 0.14 ${planet.hue} / 0.42)`);
      glow.addColorStop(1, `oklch(0.85 0.14 ${planet.hue} / 0)`);
      context.fillStyle = glow;
      context.beginPath();
      context.arc(px, py, pr * 4, 0, Math.PI * 2);
      context.fill();
    }

    // Lit from the core, so the highlight always faces inward — the one detail
    // that makes flat circles read as spheres.
    const toCore = Math.atan2(coreY - py, coreX - px);

    /*
     * ATMOSPHERE, on every body rather than only the active one.
     *
     * A rim of scattered light just outside the silhouette. This is what stops
     * the spheres reading as flat discs pasted on the starfield: a hard edge
     * against black says "circle", a soft one says "world with air". Width and
     * strength come from the planet's own `atmosphere`, so a hazy body and a
     * bare rocky one are distinguishable by outline alone.
     *
     * Faded by depth as well, or the far side of the system glows as brightly
     * as the near side and the whole illusion of a volume collapses.
     */
    const airR = pr * (1.22 + planet.atmosphere * 0.85);
    const air = context.createRadialGradient(px, py, pr * 0.88, px, py, airR);
    air.addColorStop(0, `oklch(0.86 0.11 ${planet.hue} / ${0.3 * planet.atmosphere * dim})`);
    air.addColorStop(0.45, `oklch(0.82 0.12 ${planet.hue} / ${0.12 * planet.atmosphere * dim})`);
    air.addColorStop(1, `oklch(0.8 0.1 ${planet.hue} / 0)`);
    context.fillStyle = air;
    context.beginPath();
    context.arc(px, py, airR, 0, Math.PI * 2);
    context.fill();

    const lit = context.createRadialGradient(
      px + Math.cos(toCore) * pr * 0.4,
      py + Math.sin(toCore) * pr * 0.4,
      pr * 0.1,
      px,
      py,
      pr,
    );
    lit.addColorStop(0, `oklch(0.93 0.1 ${planet.hue} / ${dim})`);
    lit.addColorStop(0.65, `oklch(0.7 0.13 ${planet.hue} / ${dim})`);
    lit.addColorStop(1, `oklch(0.42 0.09 ${planet.hue} / ${dim * 0.9})`);
    context.fillStyle = lit;
    context.beginPath();
    context.arc(px, py, pr, 0, Math.PI * 2);
    context.fill();

    /*
     * THE SURFACE, AND WHY THE ROTATION NEEDS IT.
     *
     * `spinAngle` advances whether or not anything is drawn to show it — and a
     * featureless sphere rotating is indistinguishable from a featureless
     * sphere sitting still. These are the features: three soft masses carried
     * across the disc by the spin, each narrowing to nothing as it reaches the
     * limb, which is what rotation looks like on a sphere seen from outside.
     *
     * Clipped to the circle, so a mass halfway round the far side is cut off by
     * the edge exactly as a real one would be. Skipped entirely below 6px,
     * where the detail is smaller than the anti-aliasing and costs eight
     * clip-and-restore pairs per frame to draw nothing anyone can see.
     */
    if (tier === "full" && pr >= 6) {
      context.save();
      context.beginPath();
      context.arc(px, py, pr, 0, Math.PI * 2);
      context.clip();

      for (let k = 0; k < 3; k += 1) {
        const theta = position.spinAngle + k * 2.1;
        // Across the disc; the cosine is how far round the body it currently
        // is, and it is what makes the mass vanish at the limb rather than
        // sliding off the edge at full width.
        const across = Math.sin(theta);
        const facing = Math.cos(theta);
        if (facing <= 0) continue; // On the far side. Not visible.
        const bandY = py + Math.sin(planet.axialTilt + k * 1.3) * pr * 0.42;
        context.fillStyle = `oklch(${0.58 + 0.12 * k * 0.5} 0.1 ${planet.hue} / ${0.2 * facing * dim})`;
        context.beginPath();
        context.ellipse(
          px + across * pr * 0.72,
          bandY,
          Math.max(0.5, pr * 0.34 * facing),
          pr * 0.3,
          planet.axialTilt,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      /*
       * THE TERMINATOR. A real shadow across the body, centred on the point
       * FURTHEST from the core, so the night side is always the side facing
       * away from the light. The lit gradient above only brightens towards the
       * core; without this the dark side is merely dimmer, and the sphere has
       * no shadow — which is the difference between shaded and lit.
       */
      const night = context.createRadialGradient(
        px - Math.cos(toCore) * pr * 1.15,
        py - Math.sin(toCore) * pr * 1.15,
        pr * 0.15,
        px - Math.cos(toCore) * pr * 0.55,
        py - Math.sin(toCore) * pr * 0.55,
        pr * 1.9,
      );
      night.addColorStop(0, "oklch(0.06 0.01 90 / 0.72)");
      night.addColorStop(0.55, "oklch(0.06 0.01 90 / 0.3)");
      night.addColorStop(1, "oklch(0.06 0.01 90 / 0)");
      context.fillStyle = night;
      context.beginPath();
      context.arc(px, py, pr, 0, Math.PI * 2);
      context.fill();

      context.restore();
    }

    if (active) {
      context.strokeStyle = `oklch(0.95 0.06 ${planet.hue} / 0.75)`;
      context.lineWidth = 1.25;
      context.beginPath();
      context.arc(px, py, pr, 0, Math.PI * 2);
      context.stroke();
    }
  }

  return positions;
}
