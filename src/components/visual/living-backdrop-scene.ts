/**
 * The drawing half of the Living Intelligence backdrop.
 *
 * Kept out of the React component so the maths is testable and so the render
 * loop holds no component state. Everything here is plain canvas 2D.
 *
 * WHY IT IS BUILT THIS WAY. A full-screen animated backdrop is the easiest
 * place in a product to spend a frame budget by accident. Three rules keep it
 * cheap:
 *
 *  1. The expensive, static parts — the wormhole spiral, the nebula orbs, the
 *     neural topology — are painted ONCE into an offscreen canvas at start-up.
 *     Per frame they cost one `drawImage` with a transform, not hundreds of
 *     gradient fills.
 *  2. Nothing uses `filter: blur()` per frame, and no CSS backdrop-filter
 *     covers the viewport. Softness comes from radial gradients baked into the
 *     static layer, which the GPU pays for once.
 *  3. The only per-frame work is the particle arcs: a bounded number of dots
 *     with additive blending, plus a slow transform on the static layer.
 */

export type BackdropIntensity = "subtle" | "cinematic";

export interface BackdropTuning {
  /** Number of animated particles. Zero means the scene is drawn static. */
  particles: number;
  /** Overall alpha applied to the whole backdrop. */
  opacity: number;
  /** Radians per second of spiral rotation. */
  spin: number;
  /** Peak breathing scale offset (0.02 = ±2%). */
  breathe: number;
  /** Device-pixel-ratio ceiling. */
  maxDpr: number;
  /**
   * Stacked flow bands drawn beneath the spiral. Zero means none are drawn at
   * all — not drawn-and-hidden — so a still scene costs nothing for them.
   */
  waveLayers: number;
  /** Peak band displacement as a fraction of canvas height. */
  waveAmplitude: number;
  /** Radians per second the bands travel. */
  waveSpeed: number;
}

/**
 * Points sampled along each band.
 *
 * Fixed rather than derived from width: a band is a smooth curve, and sampling
 * it per pixel spends the frame budget on a shape nobody can tell apart from
 * this one. Five bands at 48 points is 240 line segments a frame, which is
 * the same order as the particle arcs already cost.
 */
export const WAVE_POINTS = 48;

/**
 * One band's height at a horizontal position, in normalised space.
 *
 * Pure, so the shape can be tested without a canvas. Two sine terms of
 * different periods keep the crest from marching in lockstep, which is what
 * makes a single sine read as a screensaver rather than as flow. `depth` moves
 * the band in parallax — the near bands travel further under the pointer than
 * the far ones, and that difference is the whole illusion of depth.
 */
export function waveY(
  x01: number,
  depth: number,
  elapsed: number,
  tuning: Pick<BackdropTuning, "waveAmplitude" | "waveSpeed">,
  pointerY = 0,
): number {
  const travel = elapsed * tuning.waveSpeed;
  const primary = Math.sin(x01 * TAU * 1.15 + travel + depth * 1.7);
  const secondary = Math.sin(x01 * TAU * 2.3 - travel * 0.62 + depth * 0.9) * 0.45;
  // Nearer bands (depth -> 1) react more to the pointer than distant ones.
  const lean = pointerY * (0.25 + depth * 0.75) * 0.6;
  return (primary + secondary) * tuning.waveAmplitude * (0.55 + depth * 0.45) + lean;
}

/**
 * Tuning is derived, never hand-set per surface, so Chat and Work cannot drift
 * apart. `still` collapses both intensities to a painted-once scene: that is
 * what reduced-motion and low-performance mode both get, and it is a real
 * picture rather than a blank panel.
 */
export function tuningFor(
  intensity: BackdropIntensity,
  opts: { still: boolean; highContrast: boolean },
): BackdropTuning {
  if (opts.highContrast) {
    // High contrast wins outright: nothing decorative sits behind the text.
    return {
      particles: 0,
      opacity: 0,
      spin: 0,
      breathe: 0,
      maxDpr: 1,
      waveLayers: 0,
      waveAmplitude: 0,
      waveSpeed: 0,
    };
  }
  const base: BackdropTuning =
    intensity === "cinematic"
      ? {
          particles: 90,
          opacity: 0.85,
          spin: 0.014,
          breathe: 0.03,
          maxDpr: 2,
          waveLayers: 5,
          waveAmplitude: 0.055,
          waveSpeed: 0.42,
        }
      : {
          particles: 34,
          opacity: 0.38,
          spin: 0.008,
          breathe: 0.015,
          maxDpr: 1.5,
          waveLayers: 3,
          waveAmplitude: 0.035,
          waveSpeed: 0.28,
        };
  if (opts.still) {
    /*
     * A still scene draws NO bands, rather than drawing them and freezing
     * them. Zero layers means the wave loop never runs, so holding still costs
     * nothing instead of costing the same and looking calmer.
     */
    return {
      ...base,
      particles: 0,
      spin: 0,
      breathe: 0,
      opacity: base.opacity * 0.8,
      maxDpr: 1,
      waveLayers: 0,
      waveAmplitude: 0,
      waveSpeed: 0,
    };
  }
  return base;
}

interface Particle {
  /** Position along the spiral, 0 at the rim and 1 at the throat. */
  t: number;
  speed: number;
  /** Angular offset so particles do not travel in a single file. */
  phase: number;
  radiusJitter: number;
  hue: number;
  size: number;
}

const TAU = Math.PI * 2;

/** Deterministic PRNG so a reload does not reshuffle the composition. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Spiral point in unit space (centre at 0,0, rim at radius 1). */
export function spiralPoint(t: number, turns: number, phase: number) {
  const clamped = Math.min(1, Math.max(0, t));
  // Radius shrinks towards the throat; the ease makes the throat feel deep.
  const radius = Math.pow(1 - clamped, 1.6);
  const angle = clamped * turns * TAU + phase;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function paintStatic(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  intensity: BackdropIntensity,
) {
  const cx = w * 0.5;
  const cy = h * 0.46;
  const R = Math.max(w, h) * 0.62;
  const rand = rng(20260817);
  const strong = intensity === "cinematic";

  ctx.clearRect(0, 0, w, h);

  // Obsidian ground with a faint lift towards the throat.
  const ground = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  ground.addColorStop(0, "rgba(24, 30, 66, 0.85)");
  ground.addColorStop(0.45, "rgba(12, 15, 34, 0.7)");
  ground.addColorStop(1, "rgba(4, 5, 12, 0)");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, w, h);

  // Nebula orbs: mint and violet, well apart so neither sits under body text.
  const orbs: Array<[number, number, number, string]> = [
    [cx - R * 0.55, cy - R * 0.3, R * 0.55, "rgba(110, 231, 183, 0.16)"],
    [cx + R * 0.5, cy + R * 0.34, R * 0.62, "rgba(167, 139, 250, 0.16)"],
    [cx + R * 0.15, cy - R * 0.5, R * 0.42, "rgba(34, 211, 238, 0.12)"],
  ];
  for (const [ox, oy, orad, colour] of orbs) {
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, orad);
    g.addColorStop(0, colour);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ox, oy, orad, 0, TAU);
    ctx.fill();
  }

  // Neural topology: nodes joined to near neighbours. Sparse, low alpha.
  const nodeCount = strong ? 46 : 28;
  const nodes: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({ x: rand() * w, y: rand() * h });
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = strong ? "rgba(148, 197, 255, 0.10)" : "rgba(148, 197, 255, 0.06)";
  const linkDist = Math.min(w, h) * 0.22;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      if (dx * dx + dy * dy < linkDist * linkDist) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }
  ctx.fillStyle = strong ? "rgba(186, 230, 253, 0.20)" : "rgba(186, 230, 253, 0.12)";
  for (const n of nodes) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 1.2, 0, TAU);
    ctx.fill();
  }

  // Indigo wormhole spiral: several offset arms drawn as tapering strokes.
  const arms = strong ? 5 : 3;
  for (let a = 0; a < arms; a++) {
    const phase = (a / arms) * TAU;
    ctx.beginPath();
    for (let s = 0; s <= 220; s++) {
      const t = s / 220;
      const p = spiralPoint(t, 2.4, phase);
      const x = cx + p.x * R;
      const y = cy + p.y * R * 0.72;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = strong ? 1.6 : 1.1;
    ctx.strokeStyle = strong ? "rgba(99, 102, 241, 0.30)" : "rgba(99, 102, 241, 0.18)";
    ctx.stroke();
  }

  // Throat glow, so the centre of the spiral reads as depth rather than a dot.
  const throat = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.22);
  throat.addColorStop(0, strong ? "rgba(56, 189, 248, 0.28)" : "rgba(56, 189, 248, 0.14)");
  throat.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = throat;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.22, 0, TAU);
  ctx.fill();
}

export interface SceneHandle {
  /** Draw one frame at the given elapsed time in seconds. */
  frame: (elapsedSeconds: number) => void;
  /** Re-measure and repaint the static layer. */
  resize: (cssWidth: number, cssHeight: number) => void;
  /** Pointer position in -1..1; ignored when no bands are drawn. */
  setPointer: (nx: number, ny: number) => void;
  dispose: () => void;
}

export interface SceneOptions {
  intensity: BackdropIntensity;
  tuning: BackdropTuning;
  /** Injectable for tests. */
  createLayer?: (w: number, h: number) => HTMLCanvasElement | null;
}

/**
 * Build a scene bound to a live canvas. Returns null when 2D is unavailable —
 * callers must treat that as "no backdrop", never as an error worth showing.
 */
export function createScene(canvas: HTMLCanvasElement, opts: SceneOptions): SceneHandle | null {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;

  const { tuning, intensity } = opts;
  const makeLayer =
    opts.createLayer ??
    ((w: number, h: number) => {
      if (typeof document === "undefined") return null;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    });

  let dpr = 1;
  let width = 0;
  let height = 0;
  let layer: HTMLCanvasElement | null = null;
  /*
   * Where the pointer is, in -1..1, and where the scene has EASED to.
   * Following the cursor directly makes the bands twitch with every stray
   * movement; easing towards it is what makes the surface feel like it has
   * mass rather than like it is tracking a mouse.
   */
  let pointerX = 0;
  let pointerY = 0;
  let easedX = 0;
  let easedY = 0;
  let lastElapsed = 0;

  const rand = rng(991);
  const particles: Particle[] = Array.from({ length: tuning.particles }, () => ({
    t: rand(),
    speed: 0.035 + rand() * 0.07,
    phase: rand() * TAU,
    radiusJitter: 0.9 + rand() * 0.22,
    hue: rand(),
    size: 0.9 + rand() * 1.6,
  }));

  function resize(cssWidth: number, cssHeight: number) {
    const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    dpr = Math.min(tuning.maxDpr, ratio);
    width = Math.max(1, Math.floor(cssWidth));
    height = Math.max(1, Math.floor(cssHeight));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    layer = makeLayer(canvas.width, canvas.height);
    if (layer) {
      const lctx = layer.getContext("2d");
      if (lctx) {
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintStatic(lctx, width, height, intensity);
      }
    }
  }

  function frame(elapsed: number) {
    if (!ctx || width === 0 || height === 0) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = tuning.opacity;

    // Static layer, slowly rotated and breathing. One composite per frame.
    if (layer) {
      const scale = 1 + Math.sin(elapsed * 0.35) * tuning.breathe;
      const angle = elapsed * tuning.spin;
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height * 0.46);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.drawImage(layer, -canvas.width / 2, -canvas.height * 0.46);
      ctx.restore();
    }

    /* ------------------------------------------------- the flow bands ---- */
    if (tuning.waveLayers > 0) {
      // Ease towards the pointer at a rate independent of frame timing.
      const dt = Math.min(0.05, Math.max(0, elapsed - lastElapsed));
      const k = 1 - Math.exp(-dt * 4);
      easedX += (pointerX - easedX) * k;
      easedY += (pointerY - easedY) * k;

      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < tuning.waveLayers; i += 1) {
        // 0 is the furthest band, 1 the nearest.
        const depth = tuning.waveLayers === 1 ? 1 : i / (tuning.waveLayers - 1);
        const baseline = canvas.height * (0.6 + depth * 0.16);
        // Parallax: near bands slide further under the pointer than far ones.
        const shift = easedX * canvas.width * 0.035 * (0.3 + depth * 0.7);

        ctx.beginPath();
        for (let n = 0; n <= WAVE_POINTS; n += 1) {
          const x01 = n / WAVE_POINTS;
          const y = waveY(x01, depth, elapsed, tuning, easedY);
          const px = x01 * canvas.width + shift;
          const py = baseline + y * canvas.height;
          if (n === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        // Nearer bands are brighter and thicker; distance reads as haze.
        ctx.globalAlpha = tuning.opacity * (0.1 + depth * 0.22);
        ctx.strokeStyle = depth > 0.6 ? "rgba(34, 211, 238, 0.95)" : "rgba(129, 140, 248, 0.95)";
        ctx.lineWidth = (0.7 + depth * 1.4) * dpr;
        ctx.lineJoin = "round";
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    lastElapsed = elapsed;

    if (particles.length === 0) {
      ctx.globalAlpha = 1;
      return;
    }

    // Electric-cyan arcs travelling down the spiral towards the throat.
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.46;
    const R = Math.max(canvas.width, canvas.height) * 0.62;
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      const t = (p.t + elapsed * p.speed) % 1;
      const head = spiralPoint(t, 2.4, p.phase);
      const tail = spiralPoint(Math.max(0, t - 0.035), 2.4, p.phase);
      const hx = cx + head.x * R * p.radiusJitter;
      const hy = cy + head.y * R * 0.72 * p.radiusJitter;
      const tx = cx + tail.x * R * p.radiusJitter;
      const ty = cy + tail.y * R * 0.72 * p.radiusJitter;
      // Fade in at the rim and out at the throat so nothing pops.
      const fade = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
      ctx.globalAlpha = tuning.opacity * fade * 0.75;
      ctx.strokeStyle = p.hue > 0.7 ? "rgba(167, 139, 250, 0.9)" : "rgba(34, 211, 238, 0.9)";
      ctx.lineWidth = p.size * dpr;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  return {
    frame,
    resize,
    /** Pointer position in -1..1. Ignored entirely when no bands are drawn. */
    setPointer: (nx: number, ny: number) => {
      pointerX = Math.max(-1, Math.min(1, nx));
      pointerY = Math.max(-1, Math.min(1, ny));
    },
    dispose: () => {
      layer = null;
    },
  };
}
